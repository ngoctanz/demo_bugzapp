# Trích cấu trúc và API từ Excel gốc

Nguồn inputs/Robot_Tu_the_4_bang_va_API.xlsx. Đây là bản đọc văn bản của bốn sheet, giữ tên trường, kiểu dữ liệu, ý nghĩa, endpoint và quy ước. Không phải Firebase Rules hoặc dữ liệu để import vào root RTDB.

## Users

### Trường dữ liệu

| STT | Tên trường | Kiểu dữ liệu | Ý nghĩa |
|---|---|---|---|
| 1 | user_id | string | Khóa nhánh {uid}, lấy từ Firebase Authentication; không cần lưu lặp. |
| 2 | full_name | string | Họ tên phụ huynh. |
| 3 | email | string | Email người dùng; Bắt buộc; email đăng nhập do Auth quản lý. |

### API gốc

| STT | Phương thức | Endpoint | Chức năng chi tiết |
|---|---|---|---|
| 1 | GET | /users/{uid}.json | Đọc hồ sơ người dùng hiện tại. |
| 2 | PUT | /users/{uid}.json | Tạo hồ sơ: {"full_name":"Phụ huynh A","email":"a@example.com"}. PUT thay toàn bộ hồ sơ ở đường dẫn này. |
| 3 | PATCH | /users/{uid}.json | Cập nhật trường thay đổi, ví dụ {"full_name":"Tên mới"}. |
| 4 | GET | /devices.json?orderBy="user_id"&equalTo="{uid}" | Lấy robot của người dùng; cần .indexOn: ["user_id"] và Rules kiểm tra điều kiện truy vấn. |

### Quy ước gốc

**STT**  Kiểu dữ liệu

**URL và xác thực**  BASE_URL là Database URL lấy từ Firebase Console. URL = BASE_URL + endpoint. Thêm ?auth={ID_TOKEN}, hoặc &auth={ID_TOKEN} nếu đã có query.

**Đường dẫn**  users/{uid}; uid lấy từ Firebase Authentication. user_id là khóa nhánh, không cần lặp trong bản ghi.

**Đăng nhập**  Firebase Authentication quản lý mật khẩu. PUT hồ sơ không tạo tài khoản đăng nhập; email trong hồ sơ không tự đổi email Auth.

**Quyền**  Người dùng chỉ đọc/sửa hồ sơ của mình. Rules kiểm tra auth.uid.

**API**  Endpoint .json là REST thật của Realtime Database. PATCH chỉ sửa trường gửi lên; PUT thay dữ liệu tại đường dẫn. App có thể dùng Firebase SDK để lắng nghe thời gian thực.

**Quy ước**  Các query đang viết dạng dễ đọc; URL-encode giá trị khi gọi thật. Rules phải kiểm tra quyền theo thiết bị; Rules không tự lọc dữ liệu. Không dùng page/page_size của API tự xây.

**Tài liệu**  https://firebase.google.com/docs/database/rest/save-data   |   https://firebase.google.com/docs/database/rest/retrieve-data

## Devices

### Trường dữ liệu

| STT | Tên trường | Kiểu dữ liệu | Ý nghĩa |
|---|---|---|---|
| 1 | device_id | string | Khóa nhánh, mã robot. |
| 2 | user_id | string | Tham chiếu logic → Users.user_id. |
| 3 | device_name | string | Tên robot. |
| 4 | monitoring_enabled | boolean | Yêu cầu bật/tắt từ app: true = bật, false = tắt; mặc định false. |
| 5 | current_posture | string | good / bad / absent / unknown; mặc định unknown. |
| 6 | monitoring_active | boolean | Robot xác nhận đang giám sát: true = có, false = không; mặc định false. |
| 7 | alert_after_sec | number (số nguyên) | Ngưỡng sai liên tục trước khi nhắc (giây), > 0. Ví dụ thử nghiệm: 30. |
| 8 | last_seen_at | number (timestamp ms) | Lần gần nhất robot liên lạc (UTC); bỏ trường nếu chưa kết nối. |

### API gốc

| STT | Phương thức | Endpoint | Chức năng chi tiết |
|---|---|---|---|
| 1 | GET | /devices.json?orderBy="user_id"&equalTo="{uid}" | Lấy robot của người dùng. Chỉ mục user_id và Rules cho truy vấn theo chủ sở hữu. |
| 2 | GET | /devices/{device_id}.json | Xem thông tin, trạng thái một robot được cấp quyền. |
| 3 | PUT | /devices/{device_id}.json | Tạo hồ sơ robot đầy đủ sau ghép nối được kiểm tra. Không dùng PUT thiếu trường lên robot đã tồn tại. |
| 4 | PATCH | /devices/{device_id}.json | Đổi tên: {"device_name":"Robot bàn học"}. |
| 5 | PATCH | /devices/{device_id}.json | App gửi {"monitoring_enabled":true,"alert_after_sec":30}. |
| 6 | PATCH | /devices/{device_id}.json | Robot gửi {"current_posture":"good","monitoring_active":true,"last_seen_at":{".sv":"timestamp"}}. |

### Quy ước gốc

**STT**  Kiểu dữ liệu

**URL và xác thực**  BASE_URL là Database URL lấy từ Firebase Console. URL = BASE_URL + endpoint. Thêm ?auth={ID_TOKEN}, hoặc &auth={ID_TOKEN} nếu đã có query.

**Đường dẫn**  devices/{device_id}; device_id là khóa nhánh. user_id lưu UID phụ huynh để xác định chủ sở hữu.

**Trạng thái**  good = đúng; bad = sai; absent = không có người; unknown = không xác định.

**Điều khiển**  monitoring_enabled là yêu cầu; monitoring_active là phản hồi. last_seen_at là timestamp mili giây UTC, không phải DATETIME2.

**Quyền**  Ghép nối qua quy trình tin cậy; không cho người dùng chiếm robot bằng cách tự đổi user_id. Rules phân biệt quyền app và robot.

**API**  Endpoint .json là REST thật của Realtime Database. PATCH chỉ sửa trường gửi lên; PUT thay dữ liệu tại đường dẫn. App có thể dùng Firebase SDK để lắng nghe thời gian thực.

**Quy ước**  Các query đang viết dạng dễ đọc; URL-encode giá trị khi gọi thật. Rules phải kiểm tra quyền theo thiết bị; Rules không tự lọc dữ liệu. Không dùng page/page_size của API tự xây.

**Tài liệu**  https://firebase.google.com/docs/database/rest/save-data   |   https://firebase.google.com/docs/database/rest/retrieve-data

## Sessions

### Trường dữ liệu

| STT | Tên trường | Kiểu dữ liệu | Ý nghĩa |
|---|---|---|---|
| 1 | session_id | string | Khóa nhánh, mã phiên học. |
| 2 | device_id | string | Tham chiếu logic → Devices.device_id. |
| 3 | started_at | number (timestamp ms) | Thời điểm bắt đầu phiên (UTC). |
| 4 | ended_at | number (timestamp ms) | Thời điểm kết thúc (UTC); bỏ trường khi đang học. Phải ≥ started_at. |
| 5 | good_count | number (số nguyên) | Số đợt ngồi đúng đã xác nhận; mặc định 0, không âm. |
| 6 | bad_count | number (số nguyên) | Số đợt ngồi sai đã xác nhận; mặc định 0, không âm. |

### API gốc

| STT | Phương thức | Endpoint | Chức năng chi tiết |
|---|---|---|---|
| 1 | GET | /sessions/{device_id}.json | Lấy các phiên học của robot thuộc quyền truy cập. |
| 2 | GET | /sessions/{device_id}/{session_id}.json | Xem chi tiết một phiên học. |
| 3 | POST | /sessions/{device_id}.json | Tạo phiên: {"device_id":"...","started_at":{".sv":"timestamp"},"good_count":0,"bad_count":0}. Trả về name làm session_id. |
| 4 | PATCH | /sessions/{device_id}/{session_id}.json | Gửi tổng bộ đếm: {"good_count":2,"bad_count":1}. Chỉ một nguồn ghi; bỏ gói cũ/trùng. |
| 5 | PATCH | /sessions/{device_id}/{session_id}.json | Kết thúc: {"ended_at":{".sv":"timestamp"},"good_count":2,"bad_count":1}. |
| 6 | GET | /sessions/{device_id}.json?orderBy="started_at"&limitToLast=10 | Lấy 10 phiên mới nhất; đặt .indexOn: ["started_at"] tại sessions/{device_id}. App sắp xếp kết quả để hiển thị. |

### Quy ước gốc

**STT**  Kiểu dữ liệu

**URL và xác thực**  BASE_URL là Database URL lấy từ Firebase Console. URL = BASE_URL + endpoint. Thêm ?auth={ID_TOKEN}, hoặc &auth={ID_TOKEN} nếu đã có query.

**Đường dẫn**  sessions/{device_id}/{session_id}. session_id là khóa nhánh do POST sinh; không cần lặp trong bản ghi.

**Cách đếm**  Đúng → Sai → Đúng → Sai: good_count = 2, bad_count = 2. Đếm đợt đã xác nhận ổn định, không đếm từng khung hình.

**Giá trị thiếu**  Chưa kết thúc thì bỏ ended_at. Trong Realtime Database, ghi null sẽ xóa trường; không lưu chuỗi "null".

**Ghi phiên**  Một robot tối đa một phiên mở. Lưu ID trả về từ POST để tái sử dụng; gọi lại POST sẽ tạo ID mới.

**API**  Endpoint .json là REST thật của Realtime Database. PATCH chỉ sửa trường gửi lên; PUT thay dữ liệu tại đường dẫn. App có thể dùng Firebase SDK để lắng nghe thời gian thực.

**Quy ước**  Các query đang viết dạng dễ đọc; URL-encode giá trị khi gọi thật. Rules phải kiểm tra quyền theo thiết bị; Rules không tự lọc dữ liệu. Không dùng page/page_size của API tự xây.

**Tài liệu**  https://firebase.google.com/docs/database/rest/save-data   |   https://firebase.google.com/docs/database/rest/retrieve-data

## Alerts

### Trường dữ liệu

| STT | Tên trường | Kiểu dữ liệu | Ý nghĩa |
|---|---|---|---|
| 1 | alert_id | string | Khóa nhánh, mã cảnh báo. |
| 2 | session_id | string | Tham chiếu logic → Sessions.session_id. |
| 3 | message | string | Nội dung, ví dụ: Bạn đã ngồi sai 30 giây. |
| 4 | created_at | number (timestamp ms) | Thời điểm tạo cảnh báo (UTC). |
| 5 | is_read | boolean | Đã đọc = true, chưa đọc = false; mặc định false. |

### API gốc

| STT | Phương thức | Endpoint | Chức năng chi tiết |
|---|---|---|---|
| 1 | GET | /alerts/{device_id}/{session_id}.json | Đọc cảnh báo trong một phiên của robot được cấp quyền. |
| 2 | GET | /alerts/{device_id}/{session_id}.json?orderBy="is_read"&equalTo=false | Lọc chưa đọc trong phiên; đặt .indexOn: ["is_read"] tại nhánh phiên. |
| 3 | GET | /alerts/{device_id}/{session_id}/{alert_id}.json | Đọc chi tiết một cảnh báo. |
| 4 | POST | /alerts/{device_id}/{session_id}.json | Tạo {"session_id":"...","message":"Ngồi sai 30 giây","created_at":{".sv":"timestamp"},"is_read":false}. Trả về name làm alert_id. |
| 5 | PATCH | /alerts/{device_id}/{session_id}/{alert_id}.json | App đánh dấu đã đọc: {"is_read":true}. |

### Quy ước gốc

**STT**  Kiểu dữ liệu

**URL và xác thực**  BASE_URL là Database URL lấy từ Firebase Console. URL = BASE_URL + endpoint. Thêm ?auth={ID_TOKEN}, hoặc &auth={ID_TOKEN} nếu đã có query.

**Đường dẫn**  alerts/{device_id}/{session_id}/{alert_id}; alert_id là khóa nhánh do POST sinh, không cần lưu lặp.

**Thông báo**  Ghi DB không tự gửi push. Cần backend/Cloud Functions gửi FCM. Không đặt thông tin quản trị FCM vào app hoặc robot.

**Số lần**  Một đợt sai có thể được nhắc nhiều lần; bad_count khác số cảnh báo. Gửi lại POST tạo bản ghi mới nên phải chống trùng.

**Đã đọc**  is_read là việc phụ huynh đọc trong app. Không phải trạng thái gửi/nhận push.

**API**  Endpoint .json là REST thật của Realtime Database. PATCH chỉ sửa trường gửi lên; PUT thay dữ liệu tại đường dẫn. App có thể dùng Firebase SDK để lắng nghe thời gian thực.

**Quy ước**  Các query đang viết dạng dễ đọc; URL-encode giá trị khi gọi thật. Rules phải kiểm tra quyền theo thiết bị; Rules không tự lọc dữ liệu. Không dùng page/page_size của API tự xây.

**Tài liệu**  https://firebase.google.com/docs/database/rest/save-data   |   https://firebase.google.com/docs/database/rest/retrieve-data
