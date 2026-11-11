# AI-Thinker ESP32-CAM posture AI + MQTT

Firmware ESP-IDF cho AI-Thinker ESP32-CAM (OV2640). Firmware nhúng model
`posture_int8.tflite`, nhận diện `good | bad | unknown`, cảnh báo tại chỗ qua
MAX98357A và gửi kết quả tới MQTT broker bằng MQTT over TLS.

## 1. Phiên bản đã dùng

- ESP-IDF `5.5.4`, target `esp32`.
- `espressif/esp-tflite-micro` `1.4.2`.
- `espressif/esp32-camera` `2.1.8`.
- MQTT 3.1.1 qua TLS; HiveMQ Cloud, EMQX Cloud và nhiều broker khác thường dùng cổng `8883`.
- Wi-Fi của ESP32-CAM chỉ hỗ trợ băng tần 2.4 GHz.

## 2. Đấu phần cứng

| Thiết bị | Nối đến |
|---|---|
| Nguồn 5 V sau công tắc | Chân `5V` ESP32-CAM và `VIN` MAX98357A |
| GND nguồn | `GND` ESP32-CAM và `GND` MAX98357A |
| MAX98357A `BCLK` | ESP32-CAM `GPIO14` |
| MAX98357A `LRC/LRCLK` | ESP32-CAM `GPIO13` |
| MAX98357A `DIN` | ESP32-CAM `GPIO12` |
| Loa | Giữa `SPK+` và `SPK-`, không nối đầu loa xuống GND |

Dùng nguồn 5 V tối thiểu 2 A. Không dùng microSD vì GPIO12/13/14 đã dành cho
I2S. GPIO12 là chân strapping: nếu bo không khởi động, tháo tạm dây
`GPIO12 -> DIN` để kiểm tra module MAX98357A có kéo chân này lên lúc reset hay
không.

## 3. Cấu hình Wi-Fi và MQTT broker

Mở ESP-IDF Terminal, vào dự án và chạy:

```powershell
cd E:\DuAn\BUGZ\ESP32\ai_thinker_posture
idf.py set-target esp32
idf.py menuconfig
```

Trong menu chọn `BUGZ robot connectivity`, rồi điền:

| Trường | Giá trị |
|---|---|
| Wi-Fi SSID | Tên Wi-Fi 2.4 GHz |
| Wi-Fi password | Mật khẩu Wi-Fi |
| MQTT broker URI | `mqtts://<hostname-HiveMQ-Cloud>:8883` |
| MQTT username | `robot01` |
| MQTT password | Mật khẩu credential trên broker |
| BUGZ device ID | `robot01` |
| Default session ID | `session-manual-001` khi chỉ test broker |
| Publish observations immediately | Bật để MQTTX thấy dữ liệu ngay |

Hostname phải lấy nguyên vẹn từ trang quản trị broker hoặc nút **Edit Connection**
(hình cây bút) của MQTTX, không lấy nhãn kết nối đã bị rút gọn bằng `...` và không
thêm `https://`. URI firmware phải có dạng `mqtts://<host-đầy-đủ>:8883`.
Để đi xuyên suốt tới backend BUGZ, MQTT username, MQTT client ID và
`device_id` phải cùng là `robot01`.

Nếu broker dùng ACL, credential của robot chỉ cần các quyền tối thiểu:

```text
Publish:   bugz/v1/devices/robot01/observations
Publish:   bugz/v1/devices/robot01/presence
Publish:   bugz/v1/devices/robot01/acks
Subscribe: bugz/v1/devices/robot01/commands
```

Không cần cấp ESP32 quyền subscribe `#`. Với broker chưa có credential, tạo một
username `robot01`, mật khẩu riêng cho robot, bật kết nối MQTT over TLS/TCP và
xác nhận cổng TLS là `8883`.

Thông tin Wi-Fi/MQTT nằm dạng plaintext trong file local `sdkconfig` và trong
firmware đã biên dịch. File này đã được `.gitignore`; không gửi hoặc commit nó.
Khi sản xuất nên chuyển credential sang quy trình provisioning/NVS riêng.

## 4. Build và nạp

Giữ nguyên cả hai thư mục anh em sau khi chuyển máy; firmware lấy model từ thư
mục export, nên chỉ copy riêng `ai_thinker_posture` sẽ không build được:

```text
ESP32/
|-- ai_thinker_posture/
`-- esp32_posture_export/model_data.cc
```

```powershell
idf.py build
idf.py -p COMx flash monitor
```

Thay `COMx` bằng cổng thật. Nếu dừng ở `Connecting...`:

1. Giữ `IO0`.
2. Bấm-thả `RST`.
3. Thả `IO0` khi bắt đầu ghi flash.
4. Nạp xong bấm `RST` một lần, không giữ IO0.

Thoát monitor bằng `Ctrl+]`.

## 5. Kiểm tra bằng MQTTX

Trong MQTTX, mở một connection debug với cấu hình:

```text
Protocol: MQTT over TLS / mqtts
Host: hostname đầy đủ của broker
Port: 8883
MQTT version: 3.1.1
Client ID: mqttx-debug-01
Username/password: credential được phép đọc topic robot01
TLS certificate verification: bật
```

MQTTX phải dùng **Client ID khác `robot01`**, nếu không MQTTX và ESP32 sẽ đá
nhau khỏi broker. Username có thể giống robot nếu ACL cho phép, nhưng Client ID
phải khác. Subscribe QoS 1:

```text
bugz/v1/devices/robot01/#
```

Khi khởi động đúng, Serial sẽ lần lượt có:

```text
Wi-Fi got IP: ...
NTP synchronized, epoch_ms=...
MQTT connected; subscribe=bugz/v1/devices/robot01/commands ...
MQTT observation #1 good ...
```

MQTTX sẽ nhận các topic:

```text
bugz/v1/devices/robot01/presence
bugz/v1/devices/robot01/observations
bugz/v1/devices/robot01/acks
```

Observation hợp lệ có dạng:

```json
{
  "schema_version": 1,
  "event_id": "robot01-boot-abc123-000001",
  "device_id": "robot01",
  "session_id": "session-manual-001",
  "boot_id": "boot-abc123",
  "sequence": 1,
  "type": "posture.observed",
  "observed_at": 1793990000000,
  "posture": "good",
  "confidence": 0.82,
  "robot_moving": false,
  "source": "real"
}
```

Payload thử cũ chỉ có `test`, `device_id`, `posture` chứng minh broker hoạt
động nhưng backend BUGZ sẽ từ chối vì thiếu trường.

### Thử lệnh bật/tắt từ MQTTX

Publish QoS 1, **Retain tắt**, tới:

```text
bugz/v1/devices/robot01/commands
```

Payload, trong đó `expires_at` phải là UTC epoch milliseconds ở tương lai. Lấy
hai giá trị mới ngay trước lúc test bằng PowerShell:

```powershell
$createdAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$expiresAt = $createdAt + 300000
"created_at=$createdAt; expires_at=$expiresAt"
```

Thay hai số tương ứng vào payload (lệnh dưới đây chỉ minh họa cấu trúc, không
dùng lại timestamp mẫu nếu nó đã hết hạn):

```json
{
  "schema_version": 1,
  "command_id": "cmd-test-001",
  "device_id": "robot01",
  "session_id": "session-manual-001",
  "type": "monitoring.set",
  "monitoring_enabled": true,
  "alert_after_sec": 30,
  "config_version": 1,
  "created_at": 1793990000000,
  "expires_at": 1793990300000
}
```

ESP32 áp dụng lệnh rồi trả ACK tại `.../acks`. Mỗi lệnh mới phải tăng
`config_version`.

Test chặng ESP32 -> broker đạt khi đủ bốn điều kiện:

1. MQTTX thấy presence retained có `status: "online"`.
2. MQTTX thấy observation mới khoảng mỗi giây.
3. Gửi command hợp lệ và thấy phản hồi trên `.../acks`.
4. Ngắt nguồn ESP32 và thấy presence retained chuyển thành `offline`.

Bốn điều kiện này chỉ xác nhận robot đã nối broker, chưa xác nhận app BUGZ đã
nhận dữ liệu.

## 6. Hành vi firmware

- Camera chụp RGB565 `160x120`.
- Resize nearest-neighbour thành `96x72`, padding đen thành `96x96`.
- Suy luận khoảng mỗi 500 ms; publish observation mỗi 1 giây bằng QoS 1.
- Đồng bộ NTP trước khi mở MQTT TLS để timestamp và chứng chỉ hợp lệ.
- Presence online và heartbeat là retained; broker phát LWT offline khi mất kết nối.
- Subscribe `commands`, kiểm tra device/session/version/hạn lệnh và trả ACK.
- `bad` liên tục 3 giây phát beep; mỗi beep cách nhau ít nhất 5 giây.
- Khi mất Wi-Fi/broker, AI và cảnh báo tại chỗ vẫn tiếp tục hoạt động.

## 7. Để dữ liệu xuất hiện trong app BUGZ

Kết nối ESP32 với broker mới chỉ hoàn thành chặng Robot -> MQTT. Cần thêm:

1. Đăng ký thiết bị `robot01` và credential trong backend BUGZ.
2. Mở một session backend có `session_id` khớp payload.
3. Chạy MQTT-to-backend bridge hoặc integration của broker. Backend hiện tạo
   command job nhưng chưa tự publish command lên broker, nên bridge cũng phải xử
   lý chiều backend -> MQTT.
4. Bridge gọi `/api/mqtt/webhook` kèm `x-bugz-webhook-secret`.
5. Backend ghi kết quả/cảnh báo sang Firebase và FCM.

Nếu chưa có bridge, MQTTX vẫn thấy dữ liệu nhưng app sẽ chưa nhận thông báo.

## 8. Xử lý lỗi nhanh

- Không vào Wi-Fi: kiểm tra mạng 2.4 GHz, SSID, mật khẩu và WPA2.
- TLS verify lỗi: kiểm tra hostname broker, NTP và URI `mqtts://...:8883`.
- `Connection refused`: sai username/password hoặc quyền broker.
- Kết nối rồi rớt liên tục: MQTTX đang dùng trùng Client ID `robot01`.
- MQTTX không thấy topic: kiểm tra ACL và subscribe `bugz/v1/devices/robot01/#`.
- Brownout/camera lỗi khi bật Wi-Fi: dùng nguồn 5 V >= 2 A, dây ngắn và tụ
  470-1000 uF gần ESP32-CAM/MAX98357A.

## 9. Giới hạn model

Model hiện chỉ huấn luyện `Good/Bad`, chưa có lớp `Absent`. Accuracy INT8 trên
tập test 27 mẫu khoảng 81,48%; chưa phải kết quả nghiệm thu trên phần cứng thật.
Đặt camera cố định ở góc nhìn ngang và thấy đủ đầu, vai, thân/hông của một người.
