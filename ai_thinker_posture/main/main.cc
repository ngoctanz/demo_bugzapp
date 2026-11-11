#include <algorithm>
#include <cerrno>
#include <cinttypes>
#include <cmath>
#include <cstdio>
#include <cstdint>
#include <cstring>
#include <ctime>
#include <sys/time.h>

#include "cJSON.h"
#include "driver/i2s_std.h"
#include "esp_camera.h"
#include "esp_crt_bundle.h"
#include "esp_event.h"
#include "esp_heap_caps.h"
#include "esp_log.h"
#include "esp_mac.h"
#include "esp_netif.h"
#include "esp_netif_sntp.h"
#include "esp_psram.h"
#include "esp_random.h"
#include "esp_system.h"
#include "esp_timer.h"
#include "esp_wifi.h"
#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"
#include "freertos/task.h"
#include "model_data.h"
#include "mqtt_client.h"
#include "nvs_flash.h"
#include "sdkconfig.h"
#include "tensorflow/lite/micro/micro_interpreter.h"
#include "tensorflow/lite/micro/micro_mutable_op_resolver.h"
#include "tensorflow/lite/micro/schema/schema_generated.h"
#include "voice_alert_pcm.h"

namespace {

constexpr char kTag[] = "posture";

// AI-Thinker ESP32-CAM (OV2640)
constexpr int kCamPwdn = 32;
constexpr int kCamReset = -1;
constexpr int kCamXclk = 0;
constexpr int kCamSiod = 26;
constexpr int kCamSioc = 27;
constexpr int kCamY9 = 35;
constexpr int kCamY8 = 34;
constexpr int kCamY7 = 39;
constexpr int kCamY6 = 36;
constexpr int kCamY5 = 21;
constexpr int kCamY4 = 19;
constexpr int kCamY3 = 18;
constexpr int kCamY2 = 5;
constexpr int kCamVsync = 25;
constexpr int kCamHref = 23;
constexpr int kCamPclk = 22;

// MAX98357A: DIN=GPIO12, LRC=GPIO13, BCLK=GPIO14.
constexpr gpio_num_t kAudioDout = GPIO_NUM_12;
constexpr gpio_num_t kAudioWs = GPIO_NUM_13;
constexpr gpio_num_t kAudioBclk = GPIO_NUM_14;

constexpr int kInputWidth = 96;
constexpr int kInputHeight = 96;
constexpr int kInputChannels = 3;
constexpr float kUnknownThreshold = 0.575f;
constexpr int64_t kBadStableUs = 3LL * 1000 * 1000;
constexpr int64_t kAlertCooldownUs = 5LL * 1000 * 1000;
constexpr size_t kTensorArenaBytes = 220 * 1024;
constexpr EventBits_t kWifiConnectedBit = BIT0;
constexpr EventBits_t kMqttConnectedBit = BIT1;
constexpr int64_t kPresenceHeartbeatUs = 30LL * 1000 * 1000;
constexpr std::time_t kMinimumValidEpoch = 1704067200;  // 2024-01-01 UTC.
constexpr size_t kMaxDeviceIdLength = 64;
constexpr size_t kMaxSessionIdLength = 64;
constexpr size_t kMaxCommandPayloadLength = 1536;

tflite::MicroMutableOpResolver<6> g_resolver;
tflite::MicroInterpreter* g_interpreter = nullptr;
TfLiteTensor* g_input = nullptr;
uint8_t* g_tensor_arena = nullptr;
i2s_chan_handle_t g_audio_tx = nullptr;
EventGroupHandle_t g_network_events = nullptr;
esp_mqtt_client_handle_t g_mqtt_client = nullptr;
portMUX_TYPE g_monitoring_mux = portMUX_INITIALIZER_UNLOCKED;
int64_t g_bad_since_us = 0;
int64_t g_last_alert_us = -kAlertCooldownUs;
int64_t g_last_observation_publish_us = 0;
int64_t g_last_presence_publish_us = 0;
uint32_t g_observation_sequence = 0;
uint32_t g_ack_sequence = 0;
uint32_t g_applied_config_version = 0;
#ifdef CONFIG_BUGZ_MONITORING_ON_BOOT
bool g_monitoring_active = true;
#else
bool g_monitoring_active = false;
#endif
char g_session_id[kMaxSessionIdLength + 1] = {};
char g_boot_id[40] = {};
char g_observations_topic[128] = {};
char g_commands_topic[128] = {};
char g_acks_topic[128] = {};
char g_presence_topic[128] = {};
char g_offline_presence[192] = {};

struct PredictionResult {
  const char* posture;
  float confidence;
};

struct MonitoringSnapshot {
  bool active;
  uint32_t config_version;
  char session_id[kMaxSessionIdLength + 1];
};

void CopyText(char* destination, size_t destination_size, const char* source) {
  if (destination == nullptr || destination_size == 0) return;
  std::snprintf(destination, destination_size, "%s", source == nullptr ? "" : source);
}

bool IsAsciiIdentifier(const char* value, size_t minimum_length,
                       size_t maximum_length, bool allow_dot = false) {
  if (value == nullptr) return false;
  const size_t length = std::strlen(value);
  if (length < minimum_length || length > maximum_length) return false;
  for (size_t i = 0; i < length; ++i) {
    const char c = value[i];
    const bool alpha_numeric =
        (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
        (c >= '0' && c <= '9');
    if (!alpha_numeric && c != '-' && c != '_' && !(allow_dot && c == '.')) {
      return false;
    }
  }
  return true;
}

int64_t EpochMilliseconds() {
  struct timeval now {};
  gettimeofday(&now, nullptr);
  return static_cast<int64_t>(now.tv_sec) * 1000 + now.tv_usec / 1000;
}

bool ClockIsSynchronized() {
  return std::time(nullptr) >= kMinimumValidEpoch;
}

MonitoringSnapshot GetMonitoringSnapshot() {
  MonitoringSnapshot snapshot{};
  portENTER_CRITICAL(&g_monitoring_mux);
  snapshot.active = g_monitoring_active;
  snapshot.config_version = g_applied_config_version;
  std::memcpy(snapshot.session_id, g_session_id, sizeof(snapshot.session_id));
  portEXIT_CRITICAL(&g_monitoring_mux);
  snapshot.session_id[kMaxSessionIdLength] = '\0';
  return snapshot;
}

bool InitDeviceIdentity() {
  if (!IsAsciiIdentifier(CONFIG_BUGZ_DEVICE_ID, 2, kMaxDeviceIdLength)) {
    ESP_LOGE(kTag, "BUGZ device ID khong hop le: chi dung A-Z, a-z, 0-9, - va _");
    return false;
  }
  if (!IsAsciiIdentifier(CONFIG_BUGZ_DEFAULT_SESSION_ID, 1,
                         kMaxSessionIdLength, true)) {
    ESP_LOGE(kTag, "Default session ID khong hop le");
    return false;
  }

  CopyText(g_session_id, sizeof(g_session_id), CONFIG_BUGZ_DEFAULT_SESSION_ID);
  uint8_t mac[6] = {};
  if (esp_read_mac(mac, ESP_MAC_WIFI_STA) != ESP_OK) {
    ESP_LOGE(kTag, "Khong doc duoc Wi-Fi MAC");
    return false;
  }
  std::snprintf(g_boot_id, sizeof(g_boot_id), "boot-%02x%02x%02x-%08" PRIx32,
                mac[3], mac[4], mac[5], esp_random());
  std::snprintf(g_observations_topic, sizeof(g_observations_topic),
                "bugz/v1/devices/%s/observations", CONFIG_BUGZ_DEVICE_ID);
  std::snprintf(g_commands_topic, sizeof(g_commands_topic),
                "bugz/v1/devices/%s/commands", CONFIG_BUGZ_DEVICE_ID);
  std::snprintf(g_acks_topic, sizeof(g_acks_topic),
                "bugz/v1/devices/%s/acks", CONFIG_BUGZ_DEVICE_ID);
  std::snprintf(g_presence_topic, sizeof(g_presence_topic),
                "bugz/v1/devices/%s/presence", CONFIG_BUGZ_DEVICE_ID);
  std::snprintf(g_offline_presence, sizeof(g_offline_presence),
                "{\"schema_version\":1,\"device_id\":\"%s\","
                "\"status\":\"offline\",\"source\":\"real\"}",
                CONFIG_BUGZ_DEVICE_ID);

  ESP_LOGI(kTag, "Device ID=%s, boot ID=%s, session=%s",
           CONFIG_BUGZ_DEVICE_ID, g_boot_id, g_session_id);
  return true;
}

bool MqttConfigurationPresent() {
  if (std::strlen(CONFIG_BUGZ_MQTT_BROKER_URI) == 0 ||
      std::strlen(CONFIG_BUGZ_MQTT_USERNAME) == 0 ||
      std::strlen(CONFIG_BUGZ_MQTT_PASSWORD) == 0) {
    ESP_LOGW(kTag, "MQTT chua cau hinh; mo idf.py menuconfig -> BUGZ robot connectivity");
    return false;
  }
  if (std::strncmp(CONFIG_BUGZ_MQTT_BROKER_URI, "mqtts://", 8) != 0) {
    ESP_LOGE(kTag, "Broker URI phai dung mqtts:// va TLS (thuong la port 8883)");
    return false;
  }
  if (std::strcmp(CONFIG_BUGZ_MQTT_USERNAME, CONFIG_BUGZ_DEVICE_ID) != 0) {
    ESP_LOGW(kTag,
             "MQTT username (%s) khac device_id (%s); backend BUGZ co the tu choi ACL",
             CONFIG_BUGZ_MQTT_USERNAME, CONFIG_BUGZ_DEVICE_ID);
  }
  return true;
}

int PublishOnlinePresence(esp_mqtt_client_handle_t client) {
  if (client == nullptr || !ClockIsSynchronized()) return -1;
  char payload[256] = {};
  std::snprintf(payload, sizeof(payload),
                "{\"schema_version\":1,\"device_id\":\"%s\","
                "\"status\":\"online\",\"observed_at\":%lld,"
                "\"source\":\"real\"}",
                CONFIG_BUGZ_DEVICE_ID,
                static_cast<long long>(EpochMilliseconds()));
  return esp_mqtt_client_enqueue(client, g_presence_topic, payload, 0, 1, 1,
                                 false);
}

void PublishCommandAck(esp_mqtt_client_handle_t client, const char* command_id) {
  if (client == nullptr || command_id == nullptr || !ClockIsSynchronized()) return;
  const MonitoringSnapshot state = GetMonitoringSnapshot();
  const uint32_t ack_sequence = ++g_ack_sequence;
  char event_id[128] = {};
  char payload[768] = {};
  std::snprintf(event_id, sizeof(event_id), "%s-ack-%s-%06" PRIu32,
                CONFIG_BUGZ_DEVICE_ID, g_boot_id, ack_sequence);
  std::snprintf(
      payload, sizeof(payload),
      "{\"schema_version\":1,\"event_id\":\"%s\","
      "\"device_id\":\"%s\",\"session_id\":\"%s\","
      "\"command_id\":\"%s\",\"type\":\"command.ack\","
      "\"monitoring_active\":%s,\"applied_config_version\":%" PRIu32 ","
      "\"observed_at\":%lld,\"source\":\"real\"}",
      event_id, CONFIG_BUGZ_DEVICE_ID, state.session_id, command_id,
      state.active ? "true" : "false", state.config_version,
      static_cast<long long>(EpochMilliseconds()));
  const int message_id =
      esp_mqtt_client_enqueue(client, g_acks_topic, payload, 0, 1, 0, false);
  ESP_LOGI(kTag, "MQTT ACK command=%s msg_id=%d active=%s", command_id,
           message_id, state.active ? "true" : "false");
}

void ProcessCommand(esp_mqtt_client_handle_t client, const char* data,
                    size_t data_length) {
  if (data == nullptr || data_length == 0 ||
      data_length > kMaxCommandPayloadLength) {
    ESP_LOGW(kTag, "Bo qua MQTT command rong/qua lon");
    return;
  }

  cJSON* root = cJSON_ParseWithLength(data, data_length);
  if (root == nullptr) {
    ESP_LOGW(kTag, "MQTT command khong phai JSON hop le");
    return;
  }

  const cJSON* schema = cJSON_GetObjectItemCaseSensitive(root, "schema_version");
  const cJSON* device = cJSON_GetObjectItemCaseSensitive(root, "device_id");
  const cJSON* session = cJSON_GetObjectItemCaseSensitive(root, "session_id");
  const cJSON* command = cJSON_GetObjectItemCaseSensitive(root, "command_id");
  const cJSON* type = cJSON_GetObjectItemCaseSensitive(root, "type");
  const cJSON* enabled = cJSON_GetObjectItemCaseSensitive(root, "monitoring_enabled");
  const cJSON* version = cJSON_GetObjectItemCaseSensitive(root, "config_version");
  const cJSON* expires = cJSON_GetObjectItemCaseSensitive(root, "expires_at");

  const bool schema_ok = schema == nullptr ||
                         (cJSON_IsNumber(schema) && schema->valuedouble == 1.0);
  const bool fields_ok =
      schema_ok && cJSON_IsString(device) && cJSON_IsString(session) &&
      cJSON_IsString(command) && cJSON_IsString(type) && cJSON_IsBool(enabled) &&
      cJSON_IsNumber(version) && cJSON_IsNumber(expires) &&
      std::strcmp(device->valuestring, CONFIG_BUGZ_DEVICE_ID) == 0 &&
      std::strcmp(type->valuestring, "monitoring.set") == 0 &&
      IsAsciiIdentifier(session->valuestring, 1, kMaxSessionIdLength, true) &&
      IsAsciiIdentifier(command->valuestring, 1, 96, true);

  if (!fields_ok) {
    ESP_LOGW(kTag, "Tu choi MQTT command: sai schema/device/session/type");
    cJSON_Delete(root);
    return;
  }

  const int64_t now_ms = EpochMilliseconds();
  const int64_t expires_at = static_cast<int64_t>(expires->valuedouble);
  if (version->valuedouble < 1.0 ||
      version->valuedouble > static_cast<double>(UINT32_MAX) ||
      std::floor(version->valuedouble) != version->valuedouble) {
    ESP_LOGW(kTag, "Bo qua command %s co config_version khong hop le",
             command->valuestring);
    cJSON_Delete(root);
    return;
  }
  const uint32_t config_version = static_cast<uint32_t>(version->valuedouble);
  if (expires_at <= now_ms) {
    ESP_LOGW(kTag, "Bo qua command %s da het han", command->valuestring);
    cJSON_Delete(root);
    return;
  }

  bool stale = false;
  portENTER_CRITICAL(&g_monitoring_mux);
  const bool session_changed = std::strcmp(session->valuestring, g_session_id) != 0;
  if (config_version < g_applied_config_version && !session_changed) {
    stale = true;
  } else {
    g_applied_config_version = config_version;
    g_monitoring_active = cJSON_IsTrue(enabled);
    const size_t session_length = std::strlen(session->valuestring);
    std::memcpy(g_session_id, session->valuestring, session_length + 1);
    g_bad_since_us = 0;
  }
  portEXIT_CRITICAL(&g_monitoring_mux);

  if (stale) {
    ESP_LOGW(kTag, "Bo qua command %s co config_version cu", command->valuestring);
    cJSON_Delete(root);
    return;
  }

  ESP_LOGI(kTag, "Ap dung command=%s session=%s monitoring=%s version=%" PRIu32,
           command->valuestring, session->valuestring,
           cJSON_IsTrue(enabled) ? "true" : "false", config_version);
  PublishCommandAck(client, command->valuestring);
  cJSON_Delete(root);
}

void MqttEventHandler(void*, esp_event_base_t, int32_t event_id,
                      void* event_data) {
  auto* event = static_cast<esp_mqtt_event_handle_t>(event_data);
  if (event == nullptr) return;

  switch (static_cast<esp_mqtt_event_id_t>(event_id)) {
    case MQTT_EVENT_CONNECTED: {
      xEventGroupSetBits(g_network_events, kMqttConnectedBit);
      const int subscribe_id =
          esp_mqtt_client_subscribe(event->client, g_commands_topic, 1);
      const int presence_id = PublishOnlinePresence(event->client);
      ESP_LOGI(kTag, "MQTT connected; subscribe=%s msg_id=%d, presence=%d",
               g_commands_topic, subscribe_id, presence_id);
      break;
    }
    case MQTT_EVENT_DISCONNECTED:
      xEventGroupClearBits(g_network_events, kMqttConnectedBit);
      ESP_LOGW(kTag, "MQTT disconnected; client se tu ket noi lai");
      break;
    case MQTT_EVENT_SUBSCRIBED:
      ESP_LOGI(kTag, "MQTT subscribed msg_id=%d", event->msg_id);
      break;
    case MQTT_EVENT_PUBLISHED:
      ESP_LOGD(kTag, "MQTT published msg_id=%d", event->msg_id);
      break;
    case MQTT_EVENT_DATA:
      if (event->current_data_offset != 0 ||
          event->data_len != event->total_data_len) {
        ESP_LOGW(kTag, "Bo qua MQTT command bi chia manh (%d/%d)",
                 event->data_len, event->total_data_len);
        break;
      }
      if (event->topic_len == static_cast<int>(std::strlen(g_commands_topic)) &&
          std::strncmp(event->topic, g_commands_topic, event->topic_len) == 0) {
        ProcessCommand(event->client, event->data,
                       static_cast<size_t>(event->data_len));
      }
      break;
    case MQTT_EVENT_ERROR:
      xEventGroupClearBits(g_network_events, kMqttConnectedBit);
      if (event->error_handle != nullptr) {
        ESP_LOGE(kTag,
                 "MQTT error type=%d tls=0x%x stack=0x%x verify=0x%x errno=%d (%s)",
                 event->error_handle->error_type,
                 event->error_handle->esp_tls_last_esp_err,
                 event->error_handle->esp_tls_stack_err,
                 event->error_handle->esp_tls_cert_verify_flags,
                 event->error_handle->esp_transport_sock_errno,
                 std::strerror(event->error_handle->esp_transport_sock_errno));
      }
      break;
    default:
      break;
  }
}

bool InitMqtt() {
  if (!MqttConfigurationPresent()) return false;

  esp_mqtt_client_config_t config{};
  config.broker.address.uri = CONFIG_BUGZ_MQTT_BROKER_URI;
  config.broker.verification.crt_bundle_attach = esp_crt_bundle_attach;
  config.credentials.client_id = CONFIG_BUGZ_DEVICE_ID;
  config.credentials.username = CONFIG_BUGZ_MQTT_USERNAME;
  config.credentials.authentication.password = CONFIG_BUGZ_MQTT_PASSWORD;
  config.session.last_will.topic = g_presence_topic;
  config.session.last_will.msg = g_offline_presence;
  config.session.last_will.qos = 1;
  config.session.last_will.retain = 1;
  config.session.keepalive = 60;
  config.network.reconnect_timeout_ms = 5000;
  config.network.timeout_ms = 10000;
  config.task.stack_size = 6144;
  config.buffer.size = 2048;
  config.buffer.out_size = 2048;
  config.outbox.limit = 16 * 1024;

  g_mqtt_client = esp_mqtt_client_init(&config);
  if (g_mqtt_client == nullptr) {
    ESP_LOGE(kTag, "esp_mqtt_client_init that bai");
    return false;
  }
  const esp_err_t register_result = esp_mqtt_client_register_event(
      g_mqtt_client, static_cast<esp_mqtt_event_id_t>(ESP_EVENT_ANY_ID),
      MqttEventHandler, nullptr);
  if (register_result != ESP_OK) {
    ESP_LOGE(kTag, "Dang ky MQTT event loi: %s",
             esp_err_to_name(register_result));
    return false;
  }
  const esp_err_t start_result = esp_mqtt_client_start(g_mqtt_client);
  if (start_result != ESP_OK) {
    ESP_LOGE(kTag, "Bat dau MQTT loi: %s", esp_err_to_name(start_result));
    return false;
  }
  ESP_LOGI(kTag, "Dang ket noi MQTT TLS: %s", CONFIG_BUGZ_MQTT_BROKER_URI);
  return true;
}

void WifiEventHandler(void*, esp_event_base_t event_base, int32_t event_id,
                      void* event_data) {
  if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_START) {
    esp_wifi_connect();
  } else if (event_base == WIFI_EVENT &&
             event_id == WIFI_EVENT_STA_DISCONNECTED) {
    xEventGroupClearBits(g_network_events,
                         kWifiConnectedBit | kMqttConnectedBit);
    const auto* disconnected =
        static_cast<wifi_event_sta_disconnected_t*>(event_data);
    ESP_LOGW(kTag, "Wi-Fi disconnected reason=%u; dang ket noi lai",
             disconnected == nullptr ? 0 : disconnected->reason);
    esp_wifi_connect();
  } else if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP) {
    const auto* got_ip = static_cast<ip_event_got_ip_t*>(event_data);
    if (got_ip != nullptr) {
      ESP_LOGI(kTag, "Wi-Fi got IP: " IPSTR, IP2STR(&got_ip->ip_info.ip));
    }
    xEventGroupSetBits(g_network_events, kWifiConnectedBit);
  }
}

bool InitWifi() {
  if (std::strlen(CONFIG_BUGZ_WIFI_SSID) == 0) {
    ESP_LOGW(kTag, "Wi-Fi chua cau hinh; AI va loa van chay offline");
    return false;
  }

  esp_err_t result = esp_netif_init();
  if (result != ESP_OK) {
    ESP_LOGE(kTag, "esp_netif_init loi: %s", esp_err_to_name(result));
    return false;
  }
  result = esp_event_loop_create_default();
  if (result != ESP_OK) {
    ESP_LOGE(kTag, "esp_event_loop_create_default loi: %s",
             esp_err_to_name(result));
    return false;
  }
  if (esp_netif_create_default_wifi_sta() == nullptr) {
    ESP_LOGE(kTag, "Khong tao duoc Wi-Fi STA netif");
    return false;
  }

  wifi_init_config_t wifi_init = WIFI_INIT_CONFIG_DEFAULT();
  result = esp_wifi_init(&wifi_init);
  if (result != ESP_OK) {
    ESP_LOGE(kTag, "esp_wifi_init loi: %s", esp_err_to_name(result));
    return false;
  }
  ESP_ERROR_CHECK(esp_event_handler_register(WIFI_EVENT, ESP_EVENT_ANY_ID,
                                             WifiEventHandler, nullptr));
  ESP_ERROR_CHECK(esp_event_handler_register(IP_EVENT, IP_EVENT_STA_GOT_IP,
                                             WifiEventHandler, nullptr));

  wifi_config_t wifi_config{};
  CopyText(reinterpret_cast<char*>(wifi_config.sta.ssid),
           sizeof(wifi_config.sta.ssid), CONFIG_BUGZ_WIFI_SSID);
  CopyText(reinterpret_cast<char*>(wifi_config.sta.password),
           sizeof(wifi_config.sta.password), CONFIG_BUGZ_WIFI_PASSWORD);
  wifi_config.sta.threshold.authmode =
      std::strlen(CONFIG_BUGZ_WIFI_PASSWORD) == 0 ? WIFI_AUTH_OPEN
                                                  : WIFI_AUTH_WPA2_PSK;

  if (esp_wifi_set_mode(WIFI_MODE_STA) != ESP_OK ||
      esp_wifi_set_config(WIFI_IF_STA, &wifi_config) != ESP_OK ||
      esp_wifi_start() != ESP_OK) {
    ESP_LOGE(kTag, "Khong khoi dong duoc Wi-Fi STA");
    return false;
  }
  ESP_LOGI(kTag, "Dang ket noi Wi-Fi 2.4 GHz SSID=%s", CONFIG_BUGZ_WIFI_SSID);
  return true;
}

void ConnectivityTask(void*) {
  if (!MqttConfigurationPresent()) {
    vTaskDelete(nullptr);
    return;
  }

  xEventGroupWaitBits(g_network_events, kWifiConnectedBit, pdFALSE, pdTRUE,
                      portMAX_DELAY);
  esp_sntp_config_t sntp_config =
      ESP_NETIF_SNTP_DEFAULT_CONFIG(CONFIG_BUGZ_NTP_SERVER);
  const esp_err_t sntp_result = esp_netif_sntp_init(&sntp_config);
  if (sntp_result != ESP_OK) {
    ESP_LOGE(kTag, "Khoi tao SNTP loi: %s", esp_err_to_name(sntp_result));
    vTaskDelete(nullptr);
    return;
  }

  int attempts = 0;
  while (!ClockIsSynchronized()) {
    xEventGroupWaitBits(g_network_events, kWifiConnectedBit, pdFALSE, pdTRUE,
                        portMAX_DELAY);
    const esp_err_t sync_result =
        esp_netif_sntp_sync_wait(pdMS_TO_TICKS(10000));
    ++attempts;
    if (sync_result != ESP_OK && attempts % 3 == 0) {
      ESP_LOGW(kTag, "Chua dong bo duoc NTP (%d lan); tiep tuc thu", attempts);
    }
  }
  ESP_LOGI(kTag, "NTP synchronized, epoch_ms=%lld",
           static_cast<long long>(EpochMilliseconds()));
  InitMqtt();
  vTaskDelete(nullptr);
}

bool InitNvs() {
  esp_err_t result = nvs_flash_init();
  if (result == ESP_ERR_NVS_NO_FREE_PAGES ||
      result == ESP_ERR_NVS_NEW_VERSION_FOUND) {
    ESP_ERROR_CHECK(nvs_flash_erase());
    result = nvs_flash_init();
  }
  if (result != ESP_OK) {
    ESP_LOGE(kTag, "NVS init loi: %s", esp_err_to_name(result));
    return false;
  }
  return true;
}

bool InitModel() {
  const tflite::Model* model = tflite::GetModel(g_posture_model);
  if (model->version() != TFLITE_SCHEMA_VERSION) {
    ESP_LOGE(kTag, "TFLite schema model=%d, runtime=%d", model->version(),
             TFLITE_SCHEMA_VERSION);
    return false;
  }

  if (g_resolver.AddAveragePool2D() != kTfLiteOk ||
      g_resolver.AddConv2D() != kTfLiteOk ||
      g_resolver.AddDepthwiseConv2D() != kTfLiteOk ||
      g_resolver.AddFullyConnected() != kTfLiteOk ||
      g_resolver.AddReshape() != kTfLiteOk ||
      g_resolver.AddSoftmax() != kTfLiteOk) {
    ESP_LOGE(kTag, "Khong dang ky duoc cac TFLite operator");
    return false;
  }

  g_tensor_arena = static_cast<uint8_t*>(heap_caps_malloc_prefer(
      kTensorArenaBytes, 2, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT,
      MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT));
  if (g_tensor_arena == nullptr) {
    ESP_LOGE(kTag, "Khong cap phat duoc tensor arena %u bytes",
             static_cast<unsigned>(kTensorArenaBytes));
    return false;
  }

  static tflite::MicroInterpreter interpreter(
      model, g_resolver, g_tensor_arena, kTensorArenaBytes);
  g_interpreter = &interpreter;
  if (g_interpreter->AllocateTensors() != kTfLiteOk) {
    ESP_LOGE(kTag, "AllocateTensors that bai; tang kTensorArenaBytes");
    return false;
  }

  g_input = g_interpreter->input(0);
  if (g_input == nullptr || g_input->type != kTfLiteInt8 ||
      g_input->dims->size != 4 || g_input->dims->data[1] != kInputHeight ||
      g_input->dims->data[2] != kInputWidth ||
      g_input->dims->data[3] != kInputChannels) {
    ESP_LOGE(kTag, "Tensor input khong phai INT8 [1,96,96,3]");
    return false;
  }

  ESP_LOGI(kTag, "Model OK: %u bytes; tensor arena dung %u/%u bytes",
           g_posture_model_len,
           static_cast<unsigned>(g_interpreter->arena_used_bytes()),
           static_cast<unsigned>(kTensorArenaBytes));
  return true;
}

bool InitCamera() {
  camera_config_t config{};
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = kCamY2;
  config.pin_d1 = kCamY3;
  config.pin_d2 = kCamY4;
  config.pin_d3 = kCamY5;
  config.pin_d4 = kCamY6;
  config.pin_d5 = kCamY7;
  config.pin_d6 = kCamY8;
  config.pin_d7 = kCamY9;
  config.pin_xclk = kCamXclk;
  config.pin_pclk = kCamPclk;
  config.pin_vsync = kCamVsync;
  config.pin_href = kCamHref;
  config.pin_sccb_sda = kCamSiod;
  config.pin_sccb_scl = kCamSioc;
  config.pin_pwdn = kCamPwdn;
  config.pin_reset = kCamReset;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_RGB565;
  config.frame_size = FRAMESIZE_QQVGA;  // 160x120 -> 96x72 + padding den.
  config.jpeg_quality = 12;
  config.fb_count = 1;
  config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
  config.fb_location = CAMERA_FB_IN_PSRAM;

  const esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    ESP_LOGE(kTag, "Camera init loi: %s", esp_err_to_name(err));
    return false;
  }
  ESP_LOGI(kTag, "Camera AI-Thinker OV2640 OK");
  return true;
}

bool InitAudio() {
  i2s_chan_config_t channel =
      I2S_CHANNEL_DEFAULT_CONFIG(I2S_NUM_1, I2S_ROLE_MASTER);
  if (i2s_new_channel(&channel, &g_audio_tx, nullptr) != ESP_OK) {
    ESP_LOGW(kTag, "Khong tao duoc I2S loa");
    g_audio_tx = nullptr;
    return false;
  }

  i2s_std_config_t config{};
  config.clk_cfg = I2S_STD_CLK_DEFAULT_CONFIG(16000);
  config.slot_cfg = I2S_STD_PHILIPS_SLOT_DEFAULT_CONFIG(
      I2S_DATA_BIT_WIDTH_16BIT, I2S_SLOT_MODE_STEREO);
  config.gpio_cfg.mclk = I2S_GPIO_UNUSED;
  config.gpio_cfg.bclk = kAudioBclk;
  config.gpio_cfg.ws = kAudioWs;
  config.gpio_cfg.dout = kAudioDout;
  config.gpio_cfg.din = I2S_GPIO_UNUSED;
  config.gpio_cfg.invert_flags = {};

  if (i2s_channel_init_std_mode(g_audio_tx, &config) != ESP_OK ||
      i2s_channel_enable(g_audio_tx) != ESP_OK) {
    ESP_LOGW(kTag, "Khoi tao MAX98357A that bai");
    i2s_del_channel(g_audio_tx);
    g_audio_tx = nullptr;
    return false;
  }
  ESP_LOGI(kTag, "MAX98357A OK: BCLK=14, LRC=13, DIN=12");
  return true;
}

void PlayVoiceAlert() {
  if (g_audio_tx == nullptr) return;

  constexpr int kSampleRate = 16000;
  constexpr int kChunkFrames = 128;
  int16_t samples[kChunkFrames * 2];

  // 1. Chuông báo nhẹ 2 nốt (C5 -> E5, tổng ~140ms) trước câu nhắc giọng nói
  constexpr int kChimeFrames = kSampleRate / 7;
  for (int base = 0; base < kChimeFrames; base += kChunkFrames) {
    const int frames = std::min(kChunkFrames, kChimeFrames - base);
    for (int i = 0; i < frames; ++i) {
      const int idx = base + i;
      const float freq = (idx < kChimeFrames / 2) ? 523.25f : 659.25f;
      const float phase = 2.0f * 3.14159265f * freq * idx /
                          static_cast<float>(kSampleRate);
      const int16_t value = static_cast<int16_t>(std::sin(phase) * 5500.0f);
      samples[i * 2] = value;
      samples[i * 2 + 1] = value;
    }
    size_t written = 0;
    i2s_channel_write(g_audio_tx, samples, frames * 2 * sizeof(int16_t),
                      &written, pdMS_TO_TICKS(1000));
  }

  // 2. Phát giọng đọc Tiếng Việt từ kVoiceAlertPcm8k (8000 Hz int8 -> 16000 Hz int16 stereo)
  const size_t total_out_frames = kVoiceAlertPcmLen * 2;
  for (size_t base = 0; base < total_out_frames; base += kChunkFrames) {
    const size_t frames = std::min(static_cast<size_t>(kChunkFrames),
                                   total_out_frames - base);
    for (size_t i = 0; i < frames; ++i) {
      const size_t out_idx = base + i;
      const size_t src_idx = out_idx / 2;
      const int16_t s0 = static_cast<int16_t>(kVoiceAlertPcm8k[src_idx]) * 220;
      const int16_t s1 = (src_idx + 1 < kVoiceAlertPcmLen)
                             ? static_cast<int16_t>(kVoiceAlertPcm8k[src_idx + 1]) * 220
                             : s0;
      const int16_t interp = (out_idx & 1) ? static_cast<int16_t>((s0 + s1) / 2) : s0;
      samples[i * 2] = interp;
      samples[i * 2 + 1] = interp;
    }
    size_t written = 0;
    i2s_channel_write(g_audio_tx, samples, frames * 2 * sizeof(int16_t),
                      &written, pdMS_TO_TICKS(1000));
  }
}

// RGB565 QQVGA -> RGB INT8 96x96. Resize nearest 160x120 to 96x72 and
// center-pad 12 black rows above/below, matching model_config.json.
bool FillInput(camera_fb_t* frame) {
  if (frame == nullptr || frame->format != PIXFORMAT_RGB565 ||
      frame->width != 160 || frame->height != 120 ||
      frame->len < 160 * 120 * 2) {
    ESP_LOGE(kTag, "Frame khong dung RGB565 160x120");
    return false;
  }

  std::memset(g_input->data.int8, -128,
              kInputWidth * kInputHeight * kInputChannels);
  constexpr int kScaledHeight = 72;
  constexpr int kPadY = (kInputHeight - kScaledHeight) / 2;

  for (int y = 0; y < kScaledHeight; ++y) {
    const int source_y = (y * frame->height) / kScaledHeight;
    for (int x = 0; x < kInputWidth; ++x) {
      const int source_x = (x * frame->width) / kInputWidth;
      const size_t source = (source_y * frame->width + source_x) * 2;
      const uint8_t high = frame->buf[source];
      const uint8_t low = frame->buf[source + 1];
      const uint8_t red = high & 0xF8;
      const uint8_t green = static_cast<uint8_t>(((high & 0x07) << 5) |
                                                  ((low & 0xE0) >> 3));
      const uint8_t blue = static_cast<uint8_t>((low & 0x1F) << 3);
      const size_t target =
          ((y + kPadY) * kInputWidth + x) * kInputChannels;
      g_input->data.int8[target] = static_cast<int8_t>(red - 128);
      g_input->data.int8[target + 1] = static_cast<int8_t>(green - 128);
      g_input->data.int8[target + 2] = static_cast<int8_t>(blue - 128);
    }
  }
  return true;
}

PredictionResult HandlePrediction(float good, float bad, int64_t now_us) {
  const float confidence = std::max(good, bad);
  if (confidence < kUnknownThreshold) {
    ESP_LOGI(kTag, "Unknown %.1f%% (Good %.1f%%, Bad %.1f%%)",
             confidence * 100.0f, good * 100.0f, bad * 100.0f);
    g_bad_since_us = 0;
    return {"unknown", confidence};
  }

  const bool is_bad = bad > good;
  ESP_LOGI(kTag, "%s %.1f%%", is_bad ? "Bad" : "Good",
           confidence * 100.0f);
  if (!is_bad) {
    g_bad_since_us = 0;
    return {"good", confidence};
  }

  if (!GetMonitoringSnapshot().active) {
    g_bad_since_us = 0;
    return {"bad", confidence};
  }
  if (g_bad_since_us == 0) g_bad_since_us = now_us;
  if (now_us - g_bad_since_us >= kBadStableUs &&
      now_us - g_last_alert_us >= kAlertCooldownUs) {
    ESP_LOGW(kTag, "Canh bao: tu the xau on dinh tren 3 giay -> Phat loa \"%s\"",
             kVoiceAlertPhrase);
    PlayVoiceAlert();
    g_last_alert_us = now_us;
  }
  return {"bad", confidence};
}

void MaybePublishPresenceHeartbeat(int64_t now_us) {
  if (g_network_events == nullptr || g_mqtt_client == nullptr ||
      (xEventGroupGetBits(g_network_events) & kMqttConnectedBit) == 0 ||
      now_us - g_last_presence_publish_us < kPresenceHeartbeatUs) {
    return;
  }
  const int message_id = PublishOnlinePresence(g_mqtt_client);
  if (message_id >= 0) {
    g_last_presence_publish_us = now_us;
    ESP_LOGD(kTag, "MQTT presence heartbeat msg_id=%d", message_id);
  }
}

void MaybePublishObservation(const PredictionResult& prediction,
                             int64_t now_us) {
  if (g_network_events == nullptr || g_mqtt_client == nullptr ||
      (xEventGroupGetBits(g_network_events) & kMqttConnectedBit) == 0 ||
      !ClockIsSynchronized()) {
    return;
  }
  const MonitoringSnapshot monitoring = GetMonitoringSnapshot();
  if (!monitoring.active || monitoring.session_id[0] == '\0') return;
  const int64_t publish_interval_us =
      static_cast<int64_t>(CONFIG_BUGZ_OBSERVATION_INTERVAL_MS) * 1000;
  if (now_us - g_last_observation_publish_us < publish_interval_us) return;

  const uint32_t sequence = ++g_observation_sequence;
  char event_id[144] = {};
  char payload[896] = {};
  std::snprintf(event_id, sizeof(event_id), "%s-%s-%06" PRIu32,
                CONFIG_BUGZ_DEVICE_ID, g_boot_id, sequence);
  std::snprintf(
      payload, sizeof(payload),
      "{\"schema_version\":1,\"event_id\":\"%s\","
      "\"device_id\":\"%s\",\"session_id\":\"%s\","
      "\"boot_id\":\"%s\",\"sequence\":%" PRIu32 ","
      "\"type\":\"posture.observed\",\"observed_at\":%lld,"
      "\"posture\":\"%s\",\"confidence\":%.4f,"
      "\"robot_moving\":false,\"source\":\"real\"}",
      event_id, CONFIG_BUGZ_DEVICE_ID, monitoring.session_id, g_boot_id,
      sequence, static_cast<long long>(EpochMilliseconds()),
      prediction.posture, static_cast<double>(prediction.confidence));
  const int message_id = esp_mqtt_client_enqueue(
      g_mqtt_client, g_observations_topic, payload, 0, 1, 0, false);
  if (message_id >= 0) {
    g_last_observation_publish_us = now_us;
    ESP_LOGI(kTag, "MQTT observation #%" PRIu32 " %s %.1f%% msg_id=%d",
             sequence, prediction.posture, prediction.confidence * 100.0f,
             message_id);
  } else {
    ESP_LOGW(kTag, "Khong enqueue duoc MQTT observation (error=%d)",
             message_id);
  }
}

void RunForever() {
  while (true) {
    camera_fb_t* frame = esp_camera_fb_get();
    if (frame == nullptr) {
      ESP_LOGW(kTag, "Khong lay duoc frame");
      vTaskDelay(pdMS_TO_TICKS(200));
      continue;
    }

    const bool prepared = FillInput(frame);
    esp_camera_fb_return(frame);
    if (!prepared) {
      vTaskDelay(pdMS_TO_TICKS(500));
      continue;
    }

    const int64_t start_us = esp_timer_get_time();
    if (g_interpreter->Invoke() != kTfLiteOk) {
      ESP_LOGE(kTag, "TFLite Invoke that bai");
      vTaskDelay(pdMS_TO_TICKS(500));
      continue;
    }
    const int64_t end_us = esp_timer_get_time();
    TfLiteTensor* output = g_interpreter->output(0);
    if (output == nullptr || output->type != kTfLiteInt8 ||
        output->bytes < 2) {
      ESP_LOGE(kTag, "Tensor output khong hop le");
      vTaskDelay(pdMS_TO_TICKS(1000));
      continue;
    }

    const float good = (output->data.int8[0] - output->params.zero_point) *
                       output->params.scale;
    const float bad = (output->data.int8[1] - output->params.zero_point) *
                      output->params.scale;
    ESP_LOGD(kTag, "Inference %lld ms", (end_us - start_us) / 1000);
    const PredictionResult prediction = HandlePrediction(good, bad, end_us);
    MaybePublishObservation(prediction, end_us);
    MaybePublishPresenceHeartbeat(end_us);
    vTaskDelay(pdMS_TO_TICKS(500));
  }
}

}  // namespace

extern "C" void app_main() {
  ESP_LOGI(kTag, "Khoi dong AI-Thinker ESP32-CAM posture AI");
  if (!InitNvs() || !InitDeviceIdentity()) return;
  if (!esp_psram_is_initialized()) {
    ESP_LOGE(kTag, "Khong tim thay PSRAM; kiem tra board va sdkconfig");
    return;
  }
  ESP_LOGI(kTag, "PSRAM: %u bytes", static_cast<unsigned>(
                                      heap_caps_get_total_size(MALLOC_CAP_SPIRAM)));

  if (!InitModel() || !InitCamera()) return;
  InitAudio();  // AI van chay va in Serial neu loa loi.
  g_network_events = xEventGroupCreate();
  if (g_network_events == nullptr) {
    ESP_LOGE(kTag, "Khong tao duoc network event group; chay offline");
  } else if (InitWifi()) {
    if (xTaskCreate(ConnectivityTask, "bugz_connectivity", 6144, nullptr, 5,
                    nullptr) != pdPASS) {
      ESP_LOGE(kTag, "Khong tao duoc connectivity task; chay offline");
    }
  }
  const MonitoringSnapshot monitoring = GetMonitoringSnapshot();
  ESP_LOGI(kTag, "Monitoring on boot=%s, session=%s",
           monitoring.active ? "true" : "false", monitoring.session_id);
  RunForever();
}
