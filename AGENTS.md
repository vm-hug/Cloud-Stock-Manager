# AGENTS.md — Quy chuẩn Kỹ thuật & Hướng dẫn Thực thi dành cho AI Agent
## Dự án: Cloud Stock Management (Modular Monolith)

> **BẮT BUỘC:** File này là **NGUỒN QUY CHUẨN DUY NHẤT (Single Source of Truth)** cho toàn bộ AI Agent và kỹ sư tham gia dự án qua mọi Phase. Tuyệt đối không tạo thêm các file quy tắc phụ (như `AGENT_GUIDELINES.md`, `AGENT.md`, `.cursorrules`, `.cursor/rules/`, `.github/copilot-instructions.md`). Mọi quyết định kiến trúc, quy ước đặt file, coding style, bất biến cơ sở dữ liệu và quy trình kiểm thử đều phải tuân thủ nghiêm ngặt tài liệu này.

---

## A. PROJECT OVERVIEW
- **Tên dự án:** Cloud Stock Management
- **Mô hình kiến trúc:** Modular Monolith
- **Quy mô đội ngũ:** 4 thành viên phát triển
- **Nền tảng triển khai:** Render (Web Service + PostgreSQL + Managed Redis)
- **CI/CD:** GitHub Actions
- **Giai đoạn hiện tại:** Phase 1 (Khởi tạo kiến trúc nền tảng Monorepo, Database Schema, Docker Compose & SCSS Foundation)

### Tech Stack cốt lõi:
1. **Monorepo:** npm workspaces kết hợp TypeScript tooling thống nhất.
2. **Backend (`apps/api`):** Node.js, Express.js, TypeScript, Prisma ORM, PostgreSQL 16, Redis 7 (thông qua `ioredis`), Zod (validation), bcrypt (hashing mật khẩu).
3. **Frontend (`apps/web`):** React 18/19, Vite, TypeScript, SCSS (Sass thuần), không sử dụng TailwindCSS hay thư viện UI bên ngoài nếu chưa được chấp thuận.
4. **Shared Package (`packages/shared`):** Chứa Type, DTO, interface, constant, schema dùng chung giữa Backend và Frontend (không chứa logic phụ thuộc React hoặc Express).
5. **Media Storage:** Cloudinary (quản lý ảnh sản phẩm qua SDK).
6. **Cache & Queue:** Redis 7 (Phase 1 dùng cho Caching, chuẩn bị nền tảng cho BullMQ ở các Phase sau).

---

## B. SINGLE SOURCE OF TRUTH & ARCHITECTURAL PRINCIPLES

1. **PostgreSQL là nguồn sự thật duy nhất** về số lượng tồn kho và các trạng thái nghiệp vụ. Không coi Redis là nguồn dữ liệu gốc.
2. **Prisma Schema và Migrations:**
   - Quản lý schema duy nhất tại `apps/api/prisma/schema.prisma`.
   - Mọi thay đổi cấu trúc bảng bắt buộc phải tạo Prisma Migration và lưu vào Git.
   - Tuyệt đối không dùng `prisma db push` trên môi trường production/staging và không quản lý migration song song bằng công cụ khác.
3. **Tính nhất quán công nghệ:**
   - Không tự ý thay đổi Tech Stack, đổi tên module, cấu trúc thư mục hoặc thay đổi quy tắc nghiệp vụ đã chốt.
   - Không tạo nhiều cách cấu hình Axios / fetch hoặc nhiều cách truy cập Database.
4. **Bảo mật & Toàn vẹn dữ liệu:**
   - Khi có chỉ thị mâu thuẫn với các bất biến bảo mật hoặc toàn vẹn dữ liệu kho, Agent phải chủ động cảnh báo và đề xuất phương án an toàn nhất.
   - Tuyệt đối không giả định hoặc báo cáo một chức năng đã hoàn thành nếu chưa được triển khai và kiểm thử thực tế.

---

## C. STRICT FILE PLACEMENT

### 1. Backend (`apps/api`)
Tất cả mã nguồn Backend bắt buộc nằm trong `apps/api/src/` và các thư mục hạ tầng được quy định rõ ràng. Không đặt controller, service, repository, route, DTO hoặc helper nghiệp vụ rải rác ở thư mục gốc.

Cấu trúc chuẩn của một module nghiệp vụ hoàn chỉnh:
```text
apps/api/src/modules/<module_name>/
├── <module_name>.routes.ts      # Khai báo endpoint, middleware (auth, validate), phân quyền
├── <module_name>.controller.ts  # Nhận Express request, đọc DTO đã xác thực, gọi service, trả HTTP response
├── <module_name>.service.ts     # Xử lý business logic, quản lý transaction, điều phối cache
├── <module_name>.repository.ts  # Truy vấn Prisma Database trực tiếp, không chứa logic HTTP/Express
└── <module_name>.schema.ts      # Schema xác thực đầu vào bằng Zod
```

**Quy định trách nhiệm phân lớp:**
- **Routes:** Chỉ định nghĩa URL path, HTTP method, middleware xác thực, phân quyền và middleware validate schema. Không chứa logic nghiệp vụ hay truy vấn database.
- **Controller:** Đóng vai trò adapter giữa HTTP và Service layer. Nhận request, trích xuất dữ liệu hợp lệ, gọi hàm service tương ứng, trả về response HTTP chuẩn (status code, payload format). Không được truy vấn Prisma trực tiếp.
- **Service:** Trọng tâm của business logic. Thực thi quy tắc nghiệp vụ, điều phối transaction (Prisma Interactive Transaction), kiểm tra điều kiện xuất/nhập, gọi repository và xử lý cache invalidation.
- **Repository:** Chịu trách nhiệm trực tiếp giao tiếp với Database qua Prisma Client. Không xử lý request/response của Express, không xử lý status code.
- **Schema:** Khai báo Zod schemas để validate `body`, `query`, `params` của request.

**Cấu hình hạ tầng (`apps/api/src/config/`):**
- Chỉ đặt cấu hình môi trường (`env.ts`), Database (`db.ts`), Redis (`redis.ts`), Cloudinary (`cloudinary.ts`).

**Thành phần dùng chung (`apps/api/src/common/`):**
- `middleware/`: Middleware xử lý lỗi (`errorHandler.ts`), middleware xác thực, rate limit, request logger.
- `errors/`: Các lớp lỗi nghiệp vụ chuẩn hóa (`AppError`, `NotFoundError`, `BadRequestError`, `UnauthorizedError`, `ConflictError`).
- `utils/`: Hàm tiện ích thuần túy (crypto, date helper, formatting).
- `types/`: Type definition mở rộng cho Express Request (như gán `req.user`).

**Entry Points:**
- `apps/api/src/app.ts`: Khởi tạo Express app, cấu hình CORS, helmet, express.json, các routes chính và middleware xử lý lỗi tập trung.
- `apps/api/src/server.ts`: Lắng nghe port HTTP, kết nối Database/Redis, xử lý Graceful Shutdown (`SIGTERM`, `SIGINT`).

> **Lưu ý:** Không tạo các file rỗng chỉ để đủ số lượng. Các module chưa làm trong Phase 1 không tạo file placeholder rỗng trừ khi Phase yêu cầu.

### 2. Frontend (`apps/web`)
- **Pages:** Mỗi trang phải nằm trong một thư mục riêng:
  ```text
  apps/web/src/pages/<page-name>/<PageName>.tsx
  apps/web/src/pages/<page-name>/<PageName>.scss
  ```
- **Shared Components:** Mỗi component dùng chung phải có thư mục riêng:
  ```text
  apps/web/src/components/<category>/<ComponentName>/<ComponentName>.tsx
  apps/web/src/components/<category>/<ComponentName>/<ComponentName>.scss
  ```
- **Không gom nhiều Page hoặc Component lớn vào chung một file.**
- **Không đặt component nghiệp vụ đặc thù vào thư mục common** nếu nó chỉ phục vụ một feature duy nhất (hãy đặt tại `apps/web/src/features/<feature>/components/`).
- **HTTP Client trung tâm:** Bắt buộc đặt tại `apps/web/src/lib/api.ts` để cấu hình base URL, credentials, token refresh interceptor.
- **API theo feature:** Đặt tại `apps/web/src/features/<feature>/api.ts` và tái sử dụng HTTP client trung tâm tại `apps/web/src/lib/api.ts`.

---

## D. FRONTEND SCSS CONVENTIONS

1. **Kiến trúc SCSS:**
   - Sử dụng Sass thuần (`sass` package).
   - Mỗi Component/Page có file SCSS riêng biệt đặt cạnh file component.
   - File định nghĩa nguồn:
     - `apps/web/src/styles/_variables.scss`: Chứa design tokens (màu sắc, spacing, typography scale, border-radius, shadows, z-index).
     - `apps/web/src/styles/_mixins.scss`: Chứa breakpoint mixins, flex/grid helpers, text ellipsis, interactive states.
     - `apps/web/src/styles/main.scss`: CSS reset, font imports, box-sizing, global body styling và import styles hệ thống.
2. **Quy tắc sử dụng:**
   - Sử dụng cú pháp Sass hiện đại: `@use '../../styles/variables' as v;` và `@use '../../styles/mixins' as m;`.
   - Tuyệt đối không import vòng lặp giữa `_variables.scss` và `_mixins.scss`.
   - Không sử dụng inline styles (`style={{ ... }}`) cho layout và định dạng giao diện.
   - Không lạm dụng `!important`.
   - Không tự ý thêm thư viện CSS utility (như TailwindCSS) hoặc component library (như MUI, Ant Design) nếu chưa có sự đồng thuận chính thức.
   - Tái sử dụng triệt để các biến trong `_variables.scss` để giữ tính đồng bộ thiết kế toàn hệ thống.

---

## E. DATABASE INVARIANTS — BẤT BIẾN NGHIỆP VỤ KHO

Các quy tắc sau đây là **BẤT BIẾN BẮT BUỘC**, không được phép vi phạm trong bất kỳ hoàn cảnh nào:

1. **PostgreSQL là nguồn sự thật duy nhất** về tồn kho.
2. **Tuyệt đối không tạo cột `quantity` trong bảng `product_variants`** để làm nguồn tồn kho.
3. **Bảng `inventory_balances` là nơi duy nhất** lưu trữ số lượng tồn thực tế theo từng kho (`warehouse_id`) và mã biến thể (`variant_id`).
4. **Khóa chính của `InventoryBalance`** là cặp khóa phức hợp `(warehouse_id, variant_id)` (`@@id([warehouseId, variantId])`).
5. **Redis chỉ đóng vai trò bộ nhớ đệm (Cache)** để tăng tốc độ truy vấn đọc, tuyệt đối không dùng Redis để quyết định nghiệp vụ kho có đủ hàng xuất hay không.
6. **Phiếu ở trạng thái `DRAFT` và `PENDING`:** Tuyệt đối không làm thay đổi tồn kho thực tế (`inventory_balances`).
7. **Chỉ phiếu ở trạng thái `POSTED`** mới được ghi nhận làm biến động tồn kho và sinh bản ghi `stock_movements`.
8. **Phiếu ở trạng thái `REJECTED` và `CANCELLED`:** Không làm thay đổi tồn kho.
9. **Mọi thao tác phê duyệt/chốt phiếu kho** (`POSTED`) phải chạy trong một **Prisma Interactive Transaction** (`prisma.$transaction(async (tx) => { ... })`).
10. **Khóa hàng (Pessimistic Locking):** Phải sử dụng câu lệnh PostgreSQL `SELECT ... FOR UPDATE` thông qua transaction client (`tx.$queryRaw`) khi đọc số dư `inventory_balances` trong quá trình chốt phiếu.
11. **Sử dụng truy vấn tham số hóa (Parameterized Query):** Khi gọi `tx.$queryRaw` hoặc `tx.$executeRaw`, bắt buộc dùng Prisma Tagged Template hoặc tham số an toàn để chống SQL Injection.
12. **Xử lý bản ghi chưa tồn tại:** Phải kiểm tra và khởi tạo bản ghi `inventory_balances` (nếu chưa có) trước khi thực hiện khóa hàng và tính toán cộng/trừ số dư.
13. **Thứ tự khóa ổn định (Stable Locking Order):** Khi một phiếu tác động lên nhiều biến thể (hoặc nhiều kho), các bản ghi balance phải được khóa theo thứ tự sắp xếp tăng dần (ví dụ theo `variant_id` hoặc `warehouse_id, variant_id`) để triệt tiêu nguy cơ Deadlock.
14. **Chống xuất âm tại Database:** Phải kiểm tra tồn kho tại transaction và chặn số lượng âm bằng cả logic ứng dụng lẫn Database Check Constraint (`CHECK (quantity >= 0)`).
15. **Tính nguyên tử (Atomicity):** Cập nhật `inventory_balances`, ghi log `stock_movements`, và cập nhật trạng thái phiếu (`status = POSTED`, `posted_at = NOW()`) phải nằm trong cùng một transaction.
16. **Audit Log:** Ghi nhận sự kiện phê duyệt vào bảng `audit_logs` một cách nhất quán.
17. **Cache Invalidation:** Chỉ thực hiện xóa cache hoặc cập nhật cache Redis **sau khi** Database transaction đã commit thành công.
18. **Không sửa tồn kho trực tiếp:** Không bao giờ cho phép cập nhật số lượng tồn thông qua các API cập nhật thông tin sản phẩm/biến thể.
19. **Soft Delete:** Không xóa cứng (`DELETE`) bản ghi `Product` hoặc `ProductVariant` đã phát sinh giao dịch kho hoặc phiếu chứng từ. Sử dụng cơ chế soft-delete (`isActive = false`, `deletedAt = NOW()`).
20. **Tính bất biến của lịch sử:** Tuyệt đối không xóa hoặc ghi đè các bản ghi trong `stock_movements`.
21. **Không Cascade Delete:** Cấm sử dụng `onDelete: Cascade` trên các quan hệ làm mất mát dữ liệu tồn kho, chứng từ kho hoặc lịch sử biến động.
22. **Phiếu chuyển kho (`TRANSFER`):** Phải trừ tồn kho tại kho xuất (`source_warehouse_id`) và cộng tồn kho tại kho nhập (`destination_warehouse_id`) đồng thời trong cùng một transaction.
23. **Chống duyệt lặp (Idempotency):** Không cho phép duyệt lại hoặc chuyển trạng thái một phiếu đã ở trạng thái `POSTED`.
24. **Kiểm thử Concurrency bắt buộc:**
    - *Kịch bản tiêu chuẩn:* Tồn kho ban đầu = 5 sản phẩm.
    - Hai yêu cầu xuất kho đồng thời đều yêu cầu xuất 4 sản phẩm.
    - Kết quả bắt buộc: Chỉ duy nhất 1 yêu cầu thành công, yêu cầu còn lại bị từ chối do không đủ tồn kho.
    - Tồn kho cuối cùng phải bằng 1 (`5 - 4 = 1`). Không được xảy ra tình trạng tồn âm hoặc trừ hai lần sai lệch.
25. **Bất biến SKU và Lịch sử kho:** Không cho phép sửa đổi mã `sku` của `ProductVariant` một khi đã phát sinh bản ghi `stock_movements`.
26. **Chống xóa SKU còn tồn kho:** Không cho phép soft-delete hoặc vô hiệu hóa `ProductVariant` nếu tổng số lượng tồn kho (`inventory_balances`) đang lớn hơn 0.
27. **Duy nhất ảnh đại diện (Single Primary Image):** Mỗi sản phẩm có tối đa 1 ảnh primary, được bảo vệ ở tầng cơ sở dữ liệu bằng PostgreSQL Partial Unique Index (`CREATE UNIQUE INDEX ON product_images (product_id) WHERE is_primary = true`). Thao tác đổi ảnh chính hoặc xóa ảnh chính phải chạy trong interactive transaction.
28. **Chống vô hiệu hóa Category có sản phẩm active:** Không cho phép vô hiệu hóa danh mục (`categories.is_active = false`) khi danh mục đó vẫn còn chứa các sản phẩm đang hoạt động (`is_active = true, deleted_at IS NULL`).
29. **Chính sách tự duyệt (Self-Approval Invariant):** Người lập phiếu (`created_by`) tuyệt đối không được phép tự phê duyệt phiếu của chính mình (`created_by != approver_id`). Phê duyệt bắt buộc phải do một Admin hoặc Manager khác thực hiện.
30. **Bảo vệ vô hiệu hóa Kho (Warehouse Deactivation Protection):** Không cho phép vô hiệu hóa kho (`warehouses.is_active = false`) khi kho đó đang còn tồn kho dương (`inventory_balances.quantity > 0`) hoặc đang có phiếu ở trạng thái `PENDING` chưa xử lý.
31. **Điều chỉnh kiểm kê có dấu (Signed Inventory Adjustment):** Phiếu kiểm kê/điều chỉnh (`ADJUSTMENT`) sử dụng trường `adjustment_delta` kiểu số nguyên có dấu khác 0 (`adjustment_delta <> 0`) để ghi nhận chênh lệch thừa/thiếu. Không ép số âm vào trường `quantity` vốn bị chặn bởi check constraint `quantity > 0`.
32. **Phòng chống tấn công Formula Injection:** Mọi trường dữ liệu văn bản xuất ra file báo cáo CSV/Excel (như tên SKU, tên sản phẩm, mã kho) nếu bắt đầu bằng các ký tự công thức (`=`, `+`, `-`, `@`, `\t`, `\r`) bắt buộc phải được tiền tố bằng dấu nháy đơn (`'`).
33. **Xử lý nền BullMQ với Redis noeviction:** Các tác vụ import file danh mục lớn bắt buộc được xử lý bất đồng bộ qua hàng đợi BullMQ với kết nối Redis riêng (`maxRetriesPerRequest: null`). Báo cáo lỗi được sinh thành file CSV lưu trữ bền vững để tải về.

---

## F. SECURITY GUIDELINES

1. **Mật khẩu & Mã hóa:**
   - Tuyệt đối không lưu mật khẩu dạng plaintext. Bắt buộc dùng `bcrypt` (tối thiểu salt rounds 10).
   - Dữ liệu seed ban đầu bắt buộc phải băm mật khẩu bằng hàm băm chuẩn.
2. **Quản lý Secrets & Biến môi trường:**
   - Không commit file `.env` thật lên Git repository.
   - Không hardcode JWT Secret, Database Password, Redis Password, Cloudinary API Key/Secret trong source code.
   - Mọi biến môi trường phải được validate qua schema tập trung tại `apps/api/src/config/env.ts`.
3. **Phòng chống tấn công:**
   - **SQL Injection:** Dùng Prisma ORM cho hầu hết truy vấn. Nếu dùng raw SQL, bắt buộc dùng template literals của Prisma (`prisma.$queryRaw\`...\``) với tham số tự động escape. Tuyệt đối không nối chuỗi thô (`+ userInput`) vào SQL.
   - **XSS & Injection:** Validate toàn bộ payload đầu vào ở API bằng Zod schemas.
   - **Broken Access Control (BAC):** Kiểm tra RBAC (`Role-Based Access Control`) tại Backend qua middleware. Không bao giờ tin tưởng Role, User ID, hoặc Warehouse ID do client gửi lên trong body/query mà không đối soát với JWT session.
   - **CORS:** Cấu hình nguồn gốc rõ ràng, không để `origin: *` khi có truyền thông tin chứng thực (credentials).
   - **Upload an toàn:** Kiểm tra MIME type, dung lượng file và extension khi tích hợp upload Cloudinary.
4. **Bảo mật Logging:**
   - Không ghi token, password, thông tin thẻ hoặc secrets vào log console hay log file.
   - Không trả stack trace chi tiết của lỗi nội bộ về cho client trong môi trường production.

---

## G. CODING CONVENTIONS

1. **TypeScript:**
   - Bật `strict: true` trong `tsconfig.json`.
   - Tránh dùng kiểu `any`. Trong trường hợp bất khả kháng, phải có comment giải thích lý do rõ ràng.
2. **Quy tắc đặt tên:**
   - **Biến, hàm, thuộc tính object, field trong Prisma:** `camelCase` (ví dụ: `warehouseId`, `quantityBefore`).
   - **Class, Interface, Type, React Component, Enum:** `PascalCase` (ví dụ: `StockDocument`, `Role`, `InventoryBalance`).
   - **Tên bảng vật lý và tên cột PostgreSQL:** `snake_case` (ví dụ: `inventory_balances`, `warehouse_id`) thông qua thuộc tính `@map` và `@@map` trong Prisma Schema.
   - **Tên file:** Thống nhất định dạng:
     - Module backend: `<module>.<layer>.ts` (ví dụ: `inventory.service.ts`).
     - React Component: `<ComponentName>.tsx` và `<ComponentName>.scss`.
     - Utilities / helpers: `kebab-case.ts` hoặc `camelCase.ts` tùy ngữ cảnh.
3. **Clean Code & Tối ưu hóa:**
   - Không viết abstraction quá phức tạp khi chưa cần thiết (YAGNI - You Aren't Gonna Need It).
   - Không lặp lại logic nghiệp vụ (DRY - Don't Repeat Yourself).
   - Mỗi package/dependency mới được thêm vào dự án phải có lý do kỹ thuật rõ ràng.

---

## H. TESTING & VERIFICATION

Các module được phát triển bắt buộc phải có kiểm thử phù hợp:
1. **Unit Tests:** Kiểm tra các hàm tính toán, helper, validation schema độc lập.
2. **Integration Tests:** Kiểm tra luồng gọi API, middleware xác thực, phân quyền và quan hệ dữ liệu.
3. **Database Transaction & Concurrency Tests:** Kiểm thử các kịch bản khóa hàng, cạnh tranh giao dịch (Race Condition) và bất biến kho.
4. **Static Analysis:**
   - `npm run typecheck`: Đảm bảo 0 lỗi TypeScript trên toàn bộ monorepo.
   - `npm run lint`: Tuân thủ linter của dự án.
   - `npm run build`: Kiểm tra biên dịch thành công cho cả Backend và Frontend.
5. **Tính trung thực:** Tuyệt đối không tuyên bố kiểm thử thành công nếu chưa chạy lệnh thực tế. Nếu thiếu môi trường (ví dụ chưa bật PostgreSQL), phải nêu rõ trạng thái chưa kiểm thử được.

---

## I. WORKFLOW CHO AI AGENT

### 1. Trước khi thực hiện công việc (Pre-task):
- Đọc kỹ `AGENTS.md` để nắm vững các nguyên tắc và bất biến liên quan.
- Khảo sát cây thư mục hiện tại để không ghi đè mã nguồn hợp lệ của các thành viên khác.
- Xác định rõ phạm vi thay đổi (module, layer, contract dữ liệu).
- Lập kế hoạch các file cần tạo mới hoặc cập nhật.

### 2. Trong khi thực hiện công việc (In-task):
- Chỉ sửa đổi trong phạm vi được yêu cầu; không tự ý mở rộng sang các Phase tiếp theo.
- Tuân thủ nghiêm ngặt cấu trúc thư mục quy định tại mục C.
- Không thay đổi API contract hoặc Schema nếu chưa phân tích tác động toàn hệ thống.
- Mọi thay đổi schema bắt buộc phải đi kèm migration tương ứng.

### 3. Sau khi hoàn thành công việc (Post-task):
- Chạy các lệnh kiểm tra: typecheck, lint, build, test.
- Rà soát danh sách file đã thay đổi để đảm bảo không sót file tạm hoặc vi phạm gitignore.
- Lập báo cáo kết quả minh bạch theo đúng cấu trúc chuẩn: nêu rõ công việc đã làm, lệnh đã chạy, kết quả thực tế và các lưu ý kỹ thuật cho Phase kế tiếp.
