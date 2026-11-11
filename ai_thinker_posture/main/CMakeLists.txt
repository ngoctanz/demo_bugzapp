set(posture_export_dir "${CMAKE_CURRENT_LIST_DIR}/../../esp32_posture_export")

idf_component_register(
    SRCS
        "main.cc"
        "${posture_export_dir}/model_data.cc"
    INCLUDE_DIRS
        "."
        "${posture_export_dir}"
    PRIV_REQUIRES
        esp_event
        esp_netif
        esp_timer
        esp_psram
        esp_driver_i2s
        esp_wifi
        json
        mbedtls
        mqtt
        nvs_flash)
