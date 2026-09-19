# Meta Business Management / business assets

Nguồn: https://developers.facebook.com/docs/marketing-api/business-manager/  
Permission reference: https://developers.facebook.com/docs/permissions/reference/

## Mục đích

Quản lý/đọc Business Portfolio và assets như ad accounts, Pages, Instagram accounts, datasets/pixels, catalogs, system users và assignment tùy endpoint/quyền.

Permission thường gặp: `business_management` và các permission domain-specific.

## Vai trò trong B2B SaaS

Nếu product kết nối nhiều khách hàng, đây là lớp quan trọng để:
- discover asset được customer cấp;
- map Business → ad account/Page/IG/WABA;
- dùng system users khi mô hình phù hợp;
- quản lý quyền theo least privilege.

## Không nên làm

Không mặc định rằng có Business ID là đọc được mọi asset. Runtime access vẫn phụ thuộc user/system user, business relationship, asset assignment và permission được duyệt.
