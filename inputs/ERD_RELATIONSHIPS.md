# Cấu trúc và quan hệ trích từ ERD

Nguồn inputs/ERD.drawio. Các tên bên dưới đọc từ XML của sơ đồ. Quan hệ một nhiều được diễn giải từ khóa tham chiếu và nhãn 1/n; RTDB không tự thực thi khóa ngoại như SQL.

## User

- user_id (PK)
- full_name
- email

## Devices

- device_id (PK)
- user_id (FK)
- device_name
- monitoring_enabled
- current_posture
- monitoring_active
- alert_after_sec
- last_seen_at

## sessions

- session_id(PK)
- device_id(FK)
- started_at
- ended_at
- good_count
- bad_count

## alerts

- alert_id(PK)
- session_id(FK)
- message
- created_at
- is_read

## Quan hệ gốc

| Bên một | Bên nhiều | Trường tham chiếu |
|---|---|---|
| User | Devices | Devices.user_id |
| Devices | sessions | sessions.device_id |
| sessions | alerts | alerts.session_id |

Đường dẫn RTDB và quy ước cụ thể lấy từ file Excel cùng firebase_schema_contract.json. Không tự chuyển thành Firestore collection vì hình vẽ trông giống ERD quan hệ.
