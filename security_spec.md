# Security Specification — Shift Handover Firebase

## 1. Data Invariants
1. Setiap dokumen `/users/{userId}` hanya boleh dibuat oleh pemilik akun (`request.auth.uid == userId`) yang terverifikasi emailnya (`email_verified == true`), dengan role awal wajib `'pengawas'`, `canEditAll == false`, dan `approvalStatus == 'pending'` (kecuali admin bootstrap `suryadi.k94@gmail.com`).
2. PII (`email`) berada di `/users/{userId}` yang dibatasi ketat `get: isOwner(userId) || isAdmin()` dan `list: isAdmin()`. Tidak ada akses baca profil oleh user lain.
3. Hanya akun yang telah disetujui (`approvalStatus == 'approved'` atau tidak diset `'pending'`/`'rejected'` untuk akun lama, serta Admin bootstrap) yang boleh mengakses `/handover_reports`.
4. Setiap dokumen `/handover_reports/{reportId}` harus memiliki `workspaceId == 'military-stability'`, `createdBy == request.auth.uid`, `updatedBy == request.auth.uid`, serta `createdAt == request.time` & `updatedAt == request.time` saat `create`. Kolom `issue` sudah dihapus dari skema.
5. Pada `update` laporan `/handover_reports/{reportId}`, kolom `id`, `workspaceId`, `createdBy`, `createdByName`, dan `createdAt` bersifat immutable (`incoming == existing`). Hanya pembuat asli (`existing.createdBy == request.auth.uid`) atau `supervisor`/`admin` yang diizinkan memperbarui.
6. `delete` pada `/users/{userId}` dan `/handover_reports/{reportId}` ditolak demi integritas jejak audit handover.

## 2. Dirty Dozen Payloads (Must Return PERMISSION_DENIED)
1. **Privilege Escalation Create (`/users/u1`)**: `{ "role": "admin", "canEditAll": true }` oleh user biasa -> DITOLAK.
2. **Privilege Escalation Update (`/users/u1`)**: Pemilik mengubah `role` menjadi `"supervisor"` atau `canEditAll: true` -> DITOLAK.
3. **PII Leak (`get`/`list` `/users/u2`)**: User biasa membaca `/users/u2` atau melist `/users` -> DITOLAK.
4. **Shadow Field Injection (`/handover_reports/r1`)**: Payload memiliki field tambahan `"isVerifiedByBot": true` -> DITOLAK (`keys().hasOnly(...)`).
5. **Email Spoofing Admin**: Token `email: "suryadi.k94@gmail.com"` dengan `email_verified: false` -> DITOLAK.
6. **Identity Spoofing (`/handover_reports/r1`)**: `createdBy` diisi UID user lain -> DITOLAK.
7. **Immutable Creator Tampering**: Update `handover_reports/r1` mengubah `createdBy` atau `createdAt` -> DITOLAK.
8. **Unauthorized Update**: Pengawas B mengubah laporan milik Pengawas A -> DITOLAK.
9. **Client Timestamp Forgery**: `createdAt` atau `updatedAt` bukan `request.time` -> DITOLAK.
10. **ID Poisoning**: Dokumen ID panjang >128 atau mengandung karakter tidak valid (`../hack`) -> DITOLAK (`isValidId`).
11. **Value Poisoning**: `information` > 2000 karakter atau `machine` kosong `""` -> DITOLAK.
12. **Blanket List Query**: Query ke `/handover_reports` tanpa `where('workspaceId', '==', 'military-stability')` -> DITOLAK.
