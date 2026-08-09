# 7esen HD — نسخة Vercel (Node)

موقع بحث عن الأفلام وتشغيل مباشر بروابط m3u8 حقيقية — يعمل مجاناً على Vercel Hobby plan، بدون متصفح.

## الملفات
```
api/index.js          — Express app (كل المسارات: /, /api/search, /api/extract, /s/:token, /watch)
lib/extractor.js      — استخراج m3u8 عبر jsdom (فك تشفير الـ obfuscated JS بدون متصفح)
lib/tokens.js         — توكينات مشفرة AES-256-GCM بزمن انتهاء (الروابط الحقيقية غير قابلة للكشف)
vercel.json           — ضبط Vercel (مدة 300s، ذاكرة 1GB)
package.json          — الاعتماديات (express + jsdom فقط — خفيف)
```

## الرفع على Vercel (مجاني بدون بطاقة)

### الطريقة الأسهل — عبر CLI:
1. ثبّت Vercel CLI: `npm i -g vercel`
2. في مجلد `vercel-7esen`: `vercel login` ثم `vercel`
3. أول مرة بيطلب إعدادات — اترك الافتراضيات
4. بعد النشر، أضف الـ env vars (أو في داشبورد Vercel):
   ```
   vercel env add FHD_CODE
   ```
   القيمة: `p2lbgWkFrykA4QyUmpHihzmc5BNzIABq` — **يضاف فقط منك، غير موجود في الملفات**
5. (اختياري) `FHD_BACKUPS` — قائمة سيرفرات احتياطية مفصولة بفواصل، على نفس `FHD_CODE`. الافتراضي في الكود (7 سيرفرات متأكدة من شغلها). FHD_API الثانوي بيُجرّب الأول ثم backups بالترتيب.
6. أعد النشر: `vercel --prod`

### الطريقة عبر الداشبورد:
1. ارفع المجلد على GitHub (repo عام أو خاص)
2. https://vercel.com → New Project → Import الـ repo
3. Framework: **Other** — التطبيق يُكتشف تلقائياً (api/index.js)
4. Settings → Environment Variables → أضف `FHD_CODE`
5. Deploy

## الحماية (الأهم)
- **الروابط:** المتصفح يرى `/s/<توكين>` فقط — التوكين AES-256-GCM بزمن انتهاء 60 دقيقة، والرابط الأصلي غير موجود في الـ HTML أو الـ network أبداً
- **الكود:** `FHD_CODE` يُقرأ من Environment Variables فقط — بدونها يعود خطأ واضح
- **التوكين الموقع:** حتى لو نُسخ، يتعطّل بعد ساعة؛ وكل segment يُمرر بتوكين جديد
- **الاستغلال:** rate limit (5 استخراجات/دقيقة لكل IP) + السماح بدومينات scdns فقط

## حدود Vercel Hobby (المجاني)
| المورد | الحد | الكافي؟ |
|---|---|---|
| مدة الـ function | 300 ثانية | ✅ الاستخراج 3-5 ثواني |
| الاستدعاءات | 1 مليون/شهر | ✅ فيلم = بضع مئات من طلبات segments |
| CPU | 4 ساعات/شهر | ✅ الاستخراج خفيف |
| التخزين | 1GB/شهر (cron) | ✅ لا يستخدم |

## ملاحظات
- أول زيارة بعد خمول: cold start بضع ثوانٍ
- المشغل: hls.js 1.5.13 — يفتح من المتصفح مباشرة
- لتجربة محلية: `FHD_CODE=... node test_server.js` ثم افتح `http://127.0.0.1:5002`
