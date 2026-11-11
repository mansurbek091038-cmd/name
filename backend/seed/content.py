"""Seed content: real texts from the old Smart Start site (src/i18n/translations.ts) and the TZ (section 9).

Prices and FAQ answers are DEMO values — the school must confirm them.
Image fields hold the *names* of files in seed/assets; seed.py swaps them for media ids.
"""
# ruff: noqa: E501

HOME = {
    "uz": {
        "logo": "@logo",
        "hero": {
            "badge": "Smart Start Xususiy Maktabi · 2022-yildan beri",
            "admission_open": "2026–2027 o'quv yiliga qabul ochiq",
            "title": "Farzandingizning kelajagi bugun boshlanadi",
            "title_accent": "bugun",
            "text": "Smart Start — zamonaviy ta'lim, kuchli ingliz tili va har bir bolaga e'tibor beriladigan xususiy maktab. Kichik sinflar, tajribali o'qituvchilar va xavfsiz muhit.",
            "motto": "«Ilm axloq bilan olinsagina foyda beradi»",
            "cta_primary": "Qabulga yozilish",
            "cta_secondary": "Maktabga ekskursiya",
            "questions": "Savollar uchun:",
            "photo_caption": "Smart Start maktab binosi",
            "image": "@school_entrance",
        },
        "stats": [
            {"value": 300, "suffix": "+", "label": "o'quvchi"},
            {"value": 45, "suffix": "+", "label": "tajribali o'qituvchi"},
            {"value": 18, "suffix": "", "label": "sinfda ko'pi bilan o'quvchi"},
            {"value": 2022, "suffix": "", "label": "yildan beri ta'lim beramiz"},
        ],
        "why": [
            {"icon": "users", "title": "Kichik sinflar", "text": "Sinfda ko'pi bilan 16-18 nafar o'quvchi — o'qituvchi har bir bolani taniydi va uning sur'atiga moslashadi."},
            {"icon": "languages", "title": "Kuchli ingliz tili", "text": "Haftasiga 8-10 soat ingliz tili, IELTS va xalqaro imtihonlarga chuqurlashtirilgan tayyorgarlik."},
            {"icon": "clock", "title": "To'liq kun", "text": "Darslar, uy vazifasini o'qituvchi nazoratida bajarish, to'garaklar va issiq 3 mahal ovqat."},
            {"icon": "message-circle", "title": "O'qituvchi bilan yaqin aloqa", "text": "Sinf rahbari farzandingizning yutuqlari va qiyinchiliklari haqida muntazam gaplashadi, ota-onalar majlislari har chorakda."},
            {"icon": "shield-check", "title": "Xavfsiz muhit", "text": "Videokuzatuv, 24/7 qo'riqlash xizmati, maktab shifokori va qulay xavfsiz transport xizmati."},
            {"icon": "award", "title": "Xalqaro sertifikatlar", "text": "IELTS, CEFR, SAT va fan olimpiadalari natijalari — har bir o'quvchining haqiqiy sertifikati bilan."},
        ],
        "cta": {
            "title": "2026–2027 o'quv yiliga qabul ochiq",
            "text": "Joylar soni cheklangan — arizangizni hoziroq qoldiring, menejerimiz 1 ish kuni ichida qo'ng'iroq qiladi.",
            "button": "Ariza qoldirish",
        },
        "stages": [
            {"key": "primary", "badge": "Boshlang'ich sinflar (1–4)", "title": "Poydevor va erta rivojlanish", "ages": "7–10 yosh", "grades": "1–4-sinflar",
             "text": "Savodxonlik, tez va to'g'ri o'qish, mental arifmetika, ingliz tiliga erta qiziqish va ijodiy fikrlash to'garaklari.",
             "points": ["Savodxonlik va tez o'qish", "Mental arifmetika va mantiq", "Ingliz tili (Oxford dasturi)", "Kichik guruhlar (16–18 nafar)"],
             "image": "@stage_primary"},
            {"key": "middle", "badge": "O'rta maktab (5–9)", "title": "Fundamental fanlar va CEFR", "ages": "11–15 yosh", "grades": "5–9-sinflar",
             "text": "Chuqurlashtirilgan matematika, fizika, ingliz tilidan milliy va xalqaro CEFR B2/C1 imtihonlariga tizimli tayyorgarlik.",
             "points": ["Chuqurlashtirilgan matematika va fizika", "CEFR B2/C1 tizimli tayyorgarlik", "Robototexnika va IT laboratoriya", "Fan olimpiadalari guruhi"],
             "image": "@stage_middle"},
            {"key": "high", "badge": "Yuqori maktab (10–11)", "title": "IELTS, SAT va OTMga qabul", "ages": "16–18 yosh", "grades": "10–11-sinflar",
             "text": "IELTS 7.5+, SAT 1400+, xorijiy va mahalliy nufuzli oliygohlarga grant yutish maqsadida shaxsiy portfolio yaratish.",
             "points": ["IELTS 7.5+ va SAT 1400+ intensiv", "Top-1000 universitetlarga grantlar", "Xalqaro portfolio va tavsiyanoma", "Shaxsiy mentorlik va OTM yo'llanmasi"],
             "image": "@stage_high"},
        ],
        "day": [
            {"time": "08:00", "title": "Kutib olish va nonushta", "text": "O'qituvchilar bolalarni eshik oldida iliq kutib oladi va energiya beruvchi nonushta."},
            {"time": "08:30", "title": "Asosiy darslar", "text": "Kichik sinflarda, 45 daqiqalik qiziqarli va interaktiv ta'lim darslari."},
            {"time": "12:30", "title": "Tushlik va dam olish", "text": "Issiq 3 mahal muvozanatli ovqat va ochiq havoda xavfsiz o'yin/sayr."},
            {"time": "14:00", "title": "Ingliz tili", "text": "Qo'shimcha soatlar, so'zlashuvga (Speaking club) asosiy amaliy urg'u."},
            {"time": "15:30", "title": "Uy vazifasi", "text": "O'qituvchi nazoratida, maktabning o'zida to'liq va mustaqil bajariladi."},
            {"time": "16:30", "title": "To'garaklar", "text": "Robototexnika, shaxmat, sport, tasviriy san'at va mental arifmetika."},
        ],
        "sections": {
            "why_title": "Nega Smart Start?",
            "why_subtitle": "Biz bolalarga yod olishni emas, fikrlashni o'rgatamiz — va bu jarayonda siz har kuni xabardor bo'lasiz.",
            "stages_title": "Ta'lim bosqichlari",
            "stages_text": "Har bir yosh davrining psixologik va intellektual xususiyatlariga moslashtirilgan o'quv dasturi.",
            "teachers_title": "Farzandingizni kimlar o'qitadi",
            "teachers_text": "Xalqaro sertifikatlarga ega, ko'p yillik tajribali metodist va o'qituvchilar jamoasi.",
            "testimonials_title": "Ota-onalar nima deydi",
            "testimonials_text": "Maktabimizda tahsil olayotgan o'quvchilarning ota-onalari samimiy fikrlari.",
            "day_badge": "Bir kun Smart Start'da",
            "day_title": "Ertalabdan kechgacha — farzandingiz ishonchli qo'llarda",
            "day_text": "To'liq kun rejimi: darslar, ovqat, dam olish, uy vazifasi va to'garaklar bitta binoda. Ishdan keyin farzandingizni vazifasi to'liq bajarilgan holda olib ketasiz.",
            "news_title": "Maktab hayoti",
            "results_kicker": "Ota-onalar uchun",
            "results_title": "O'quvchilarimiz natijalari",
            "results_text": "Har bir sertifikat — haqiqiy o'quvchi va haqiqiy mehnat. Natijalarni tekshirib ko'rishingiz mumkin.",
        },
    },
    "ru": {
        "hero": {
            "badge": "Частная школа Smart Start · С 2022 года",
            "admission_open": "Открыт приём на 2026–2027 учебный год",
            "title": "Будущее вашего ребёнка начинается сегодня",
            "title_accent": "сегодня",
            "text": "Smart Start — современное образование, углублённый английский язык и индивидуальное внимание к каждому ученику. Небольшие классы, опытные педагоги и безопасная среда.",
            "motto": "«Знания приносят истинную пользу лишь в сочетании с благонравием»",
            "cta_primary": "Записаться на приём",
            "cta_secondary": "Экскурсия по школе",
            "questions": "По всем вопросам:",
            "photo_caption": "Здание школы Smart Start",
        },
        "stats": [
            {"label": "учеников"}, {"label": "опытных педагогов"},
            {"label": "максимум учеников в классе"}, {"label": "года обучаем будущих лидеров"},
        ],
        "why": [
            {"title": "Небольшие классы", "text": "В классе максимум 16-18 учеников — учитель уделяет внимание каждому и адаптируется к его темпу."},
            {"title": "Углублённый английский", "text": "8-10 часов английского в неделю, системная подготовка к IELTS и международным экзаменам."},
            {"title": "Полный день пребывания", "text": "Уроки, выполнение домашних заданий под руководством педагогов, секции и 3-разовое горячее питание."},
            {"title": "Тесная связь с учителем", "text": "Классный руководитель регулярно информирует родителей об успехах и трудностях ребёнка, родительские собрания — каждую четверть."},
            {"title": "Безопасная среда", "text": "Видеонаблюдение, круглосуточная охрана 24/7, штатный врач и комфортабельный школьный транспорт."},
            {"title": "Международные сертификаты", "text": "Результаты IELTS, CEFR, SAT и олимпиад — с подлинными сертификатами учеников."},
        ],
        "cta": {
            "title": "Открыт приём на 2026–2027 учебный год",
            "text": "Количество мест ограничено — оставьте заявку прямо сейчас, наш менеджер перезвонит в течение 1 рабочего дня.",
            "button": "Оставить заявку",
        },
        "stages": [
            {"badge": "Начальная школа (1–4)", "title": "Фундамент и раннее развитие", "ages": "7–10 лет", "grades": "1–4 классы",
             "text": "Грамотность, быстрочтение, ментальная арифметика, раннее погружение в английский и творческие кружки.",
             "points": ["Грамотность и быстрочтение", "Ментальная арифметика", "Английский по методике Oxford", "Мини-классы до 18 учеников"]},
            {"badge": "Средняя школа (5–9)", "title": "Фундаментальные науки и CEFR", "ages": "11–15 лет", "grades": "5–9 классы",
             "text": "Углублённая математика, физика, системная подготовка к национальным и международным экзаменам CEFR B2/C1.",
             "points": ["Углублённая математика и физика", "Подготовка к CEFR B2/C1", "STEM, IT и робототехника", "Олимпиадные факультативы"]},
            {"badge": "Старшая школа (10–11)", "title": "IELTS, SAT и поступление в вузы", "ages": "16–18 лет", "grades": "10–11 классы",
             "text": "IELTS 7.5+, SAT 1400+, создание персонального портфолио для поступления на гранты в ведущие вузы.",
             "points": ["Интенсив IELTS 7.5+ и SAT 1400+", "Гранты в ТОП-1000 университетов", "Международное портфолио", "Профориентация и менторство"]},
        ],
        "day": [
            {"title": "Встреча и завтрак", "text": "Тёплый приём учителями у дверей школы и полезный сбалансированный завтрак."},
            {"title": "Основные уроки", "text": "Интерактивные и увлекательные 45-минутные уроки в мини-группах."},
            {"title": "Обед и отдых", "text": "Горячий сбалансированный обед и прогулка/игры на свежем воздухе."},
            {"title": "Английский язык", "text": "Дополнительные часы с упором на разговорную практику (Speaking Club)."},
            {"title": "Домашнее задание", "text": "Самостоятельное выполнение заданий в школе под присмотром учителей."},
            {"title": "Кружки и секции", "text": "Робототехника, шахматы, спорт, живопись и ментальная арифметика."},
        ],
        "sections": {
            "why_title": "Почему Smart Start?",
            "why_subtitle": "Мы учим детей мыслить, а не заучивать — и вы ежедневно в курсе успехов вашего ребёнка.",
            "stages_title": "Ступени образования",
            "stages_text": "Учебная программа адаптирована под психологические и интеллектуальные особенности каждого возраста.",
            "teachers_title": "Кто учит вашего ребёнка",
            "teachers_text": "Команда методистов и преподавателей с многолетним опытом и международными сертификатами.",
            "testimonials_title": "Что говорят родители",
            "testimonials_text": "Искренние отзывы родителей учеников школы Smart Start.",
            "day_badge": "Один день в Smart Start",
            "day_title": "С утра до вечера — ребёнок в надёжных руках",
            "day_text": "Режим полного дня: уроки, питание, отдых, домашние задания и кружки в одном здании. Вечером вы забираете ребёнка со всеми выполненными уроками.",
            "news_title": "Школьная жизнь",
            "results_kicker": "Для родителей",
            "results_title": "Результаты наших учеников",
            "results_text": "Каждый сертификат — результат труда реального ученика. Вы можете проверить каждый из них.",
        },
    },
    "en": {
        "hero": {
            "badge": "Smart Start Private School · Est. 2022",
            "admission_open": "Admissions open for the 2026–2027 academic year",
            "title": "Your Child's Future Begins Today",
            "title_accent": "Today",
            "text": "Smart Start — modern education, intensive English, and individual attention for every child. Small class sizes, experienced faculty, and a secure environment.",
            "motto": "«Knowledge bears true fruit only when paired with integrity»",
            "cta_primary": "Apply for Admission",
            "cta_secondary": "Campus Tour",
            "questions": "For inquiries:",
            "photo_caption": "Smart Start school building",
        },
        "stats": [
            {"label": "students"}, {"label": "experienced teachers"},
            {"label": "students per class at most"}, {"label": "educating future leaders since"},
        ],
        "why": [
            {"title": "Small Class Sizes", "text": "Maximum 16-18 students per class — teachers know each child personally and adapt to their learning pace."},
            {"title": "Intensive English", "text": "8-10 hours of English per week with dedicated IELTS and international exam preparation."},
            {"title": "Full-Day Program", "text": "Lessons, teacher-supervised homework, clubs, and 3 hot nutritious meals daily."},
            {"title": "Close Parent-Teacher Bond", "text": "Homeroom teachers regularly update parents on progress and challenges; parent meetings every term."},
            {"title": "Safe & Secure Environment", "text": "CCTV surveillance, 24/7 security, a school doctor, and safe modern school transportation."},
            {"title": "Recognized Certifications", "text": "IELTS, CEFR, SAT, and Olympiad achievements — each backed by the student's real certificate."},
        ],
        "cta": {
            "title": "Admissions open for 2026–2027",
            "text": "Places are limited — leave your application now and our manager will call you within one business day.",
            "button": "Apply now",
        },
        "stages": [
            {"badge": "Primary School (Grades 1–4)", "title": "Foundation & Early Development", "ages": "Ages 7–10", "grades": "Grades 1–4",
             "text": "Literacy, speed reading, mental math, early English immersion, and creative thinking workshops.",
             "points": ["Literacy & speed reading", "Mental math & critical logic", "Early Oxford English program", "Small classes (max 18)"]},
            {"badge": "Middle School (Grades 5–9)", "title": "Core Sciences & CEFR", "ages": "Ages 11–15", "grades": "Grades 5–9",
             "text": "Advanced mathematics, physics, and systematic preparation for national and international CEFR B2/C1 exams.",
             "points": ["Advanced Math & Physics", "Systematic CEFR B2/C1 prep", "STEM & Robotics Lab", "Olympiad competitions"]},
            {"badge": "High School (Grades 10–11)", "title": "IELTS, SAT & College Admissions", "ages": "Ages 16–18", "grades": "Grades 10–11",
             "text": "IELTS 7.5+, SAT 1400+, and building a strong personal portfolio to win scholarships at top universities.",
             "points": ["IELTS 7.5+ & SAT 1400+ mastery", "Top-1000 University grants", "International portfolio building", "1-on-1 university counseling"]},
        ],
        "day": [
            {"title": "Arrival & Breakfast", "text": "Warm welcome by faculty at the entrance followed by an energizing, wholesome breakfast."},
            {"title": "Core Academic Classes", "text": "Engaging and interactive 45-minute lessons in small class settings."},
            {"title": "Lunch & Recreation", "text": "Hot balanced lunch and supervised outdoor playtime."},
            {"title": "Intensive English", "text": "Immersive sessions focused on conversation and Speaking Club practice."},
            {"title": "Supervised Study", "text": "All homework completed at school under teacher supervision."},
            {"title": "Clubs & Activities", "text": "Robotics, chess, athletics, visual arts, and mental math."},
        ],
        "sections": {
            "why_title": "Why Smart Start?",
            "why_subtitle": "We teach children how to think, not just memorize — and you stay informed every step of the way.",
            "stages_title": "Academic Stages",
            "stages_text": "Curriculum tailored to the developmental and intellectual needs of each age group.",
            "teachers_title": "Who Teaches Your Child",
            "teachers_text": "A dedicated team of educators with extensive experience and internationally recognized credentials.",
            "testimonials_title": "What Parents Say",
            "testimonials_text": "Honest impressions from parents of students currently attending Smart Start.",
            "day_badge": "A Day at Smart Start",
            "day_title": "From Morning to Evening — In Trusted Hands",
            "day_text": "Full-day schedule: classes, meals, recreation, homework, and clubs under one roof. Pick up your child with homework done.",
            "news_title": "School Life",
            "results_kicker": "For Parents",
            "results_title": "Our Students' Results",
            "results_text": "Every certificate reflects a real student's hard work. You can verify each one.",
        },
    },
}

ABOUT = {
    "uz": {
        "title": "Maktab haqida",
        "story": "Smart Start 2022-yilda bir maqsad bilan ochilgan: bolalarga yod olishni emas, fikrlashni o'rgatish. Bugun maktabimizda 300 dan ortiq o'quvchi tahsil oladi.",
        "mission": "Har bir bolaning qobiliyatini ochish va uni zamonaviy dunyoda ishonch bilan yashashga tayyorlash.",
        "values_title": "Qadriyatlarimiz",
        "values": ["Hurmat", "Qiziquvchanlik", "Mas'uliyat", "Halollik"],
        "founded_year": 2022,
        "image": "@classroom",
    },
    "ru": {
        "title": "О школе",
        "story": "Smart Start открылась в 2022 году с одной целью: учить детей не зубрить, а думать. Сегодня в нашей школе учатся более 300 учеников.",
        "mission": "Раскрыть способности каждого ребёнка и подготовить его уверенно жить в современном мире.",
        "values_title": "Наши ценности",
        "values": ["Уважение", "Любознательность", "Ответственность", "Честность"],
    },
    "en": {
        "title": "About the School",
        "story": "Smart Start opened in 2022 with one goal: to teach children to think, not to memorize. Today more than 300 students study at our school.",
        "mission": "To unlock every child's potential and prepare them to live confidently in the modern world.",
        "values_title": "Our Values",
        "values": ["Respect", "Curiosity", "Responsibility", "Honesty"],
    },
}

ADMISSION = {
    "uz": {
        "title": "Qabul 4 qadamda",
        "text": "Joylar soni cheklangan. Arizangizni qoldiring — menejerimiz 1 ish kuni ichida qo'ng'iroq qiladi va maktabga tanishuvga taklif qiladi.",
        "steps": [
            {"title": "Ariza qoldiring", "text": "Saytda yoki telefon orqali."},
            {"title": "Tanishuv", "text": "Maktabga keling, sinflar va o'qituvchilar bilan tanishing."},
            {"title": "Diagnostik suhbat", "text": "Farzandingiz bilimini aniqlaymiz (imtihon emas, qo'rqmaslik kerak)."},
            {"title": "Shartnoma", "text": "Hujjatlarni topshirib, o'qishni boshlaysiz."},
        ],
        "documents_title": "Kerakli hujjatlar",
        "documents": [
            "Tug'ilganlik guvohnomasi nusxasi",
            "Tibbiy ma'lumotnoma (086-shakl)",
            "3x4 rasm (4 dona)",
            "Ota-ona pasporti nusxasi",
            "Oldingi maktabdan tabel (2-sinfdan boshlab)",
        ],
        "faq_title": "Ko'p beriladigan savollar",
        "prices_title": "O'qish narxlari",
    },
    "ru": {
        "title": "Поступление в 4 шага",
        "text": "Количество мест ограничено. Оставьте заявку — наш менеджер перезвонит в течение 1 рабочего дня и пригласит на знакомство со школой.",
        "steps": [
            {"title": "Оставьте заявку", "text": "На сайте или по телефону."},
            {"title": "Знакомство", "text": "Приходите в школу, познакомьтесь с классами и учителями."},
            {"title": "Диагностическая беседа", "text": "Определяем знания ребёнка (это не экзамен, бояться не нужно)."},
            {"title": "Договор", "text": "Сдаёте документы и начинаете учёбу."},
        ],
        "documents_title": "Необходимые документы",
        "documents": [
            "Копия свидетельства о рождении",
            "Медицинская справка (форма 086)",
            "Фото 3x4 (4 шт.)",
            "Копия паспорта родителя",
            "Табель из предыдущей школы (со 2 класса)",
        ],
        "faq_title": "Частые вопросы",
        "prices_title": "Стоимость обучения",
    },
    "en": {
        "title": "Admission in 4 Steps",
        "text": "Places are limited. Leave an application — our manager will call you within one business day and invite you to visit the school.",
        "steps": [
            {"title": "Apply", "text": "Online or by phone."},
            {"title": "Visit", "text": "Come to the school and meet the classes and teachers."},
            {"title": "Diagnostic chat", "text": "We assess your child's knowledge (not an exam — nothing to fear)."},
            {"title": "Contract", "text": "Submit the documents and start studying."},
        ],
        "documents_title": "Required documents",
        "documents": [
            "Copy of the birth certificate",
            "Medical certificate (form 086)",
            "3x4 photos (4 pcs)",
            "Copy of a parent's passport",
            "Report card from the previous school (from grade 2)",
        ],
        "faq_title": "Frequently Asked Questions",
        "prices_title": "Tuition",
    },
}

# 120100, Sirdaryo viloyati, Guliston, Al-Xorazmiy ko‘chasi, 36
LAT, LNG = 40.4900, 68.7830
MAP_EMBED = "https://maps.google.com/maps?q=120100,+Sirdaryo+viloyati,+Guliston,+Al-Xorazmiy+ko'chasi,+36&z=16&hl=uz&output=embed"

CONTACT = {
    "uz": {
        "title": "Biz bilan bog'laning",
        "text": "Savolingiz bormi? Qo'ng'iroq qiling, Telegram'da yozing yoki maktabga keling — sizni choy bilan kutib olamiz.",
        "address": "120100, Sirdaryo viloyati, Guliston, Al-Xorazmiy ko‘chasi, 36",
        "phones": ["+998 98 560 07 20"],
        "telegram": "https://t.me/stmartstartt_bot",
        "instagram": "",
        "hours": "Du–Ju: 08:30–17:30, Sha: 08:30–12:00",
        "map_embed_url": MAP_EMBED,
        "lat": LAT,
        "lng": LNG,
    },
    "ru": {
        "title": "Свяжитесь с нами",
        "text": "Есть вопросы? Позвоните, напишите в Telegram или приходите в школу — встретим вас с чаем.",
        "address": "120100, Сырдарьинская область, Гулистан, улица Аль-Хорезми, 36",
        "phones": ["+998 98 560 07 20"],
        "hours": "Пн–Пт: 08:30–17:30, Сб: 08:30–12:00",
        "map_embed_url": MAP_EMBED,
        "lat": LAT,
        "lng": LNG,
    },
    "en": {
        "title": "Contact Us",
        "text": "Have a question? Call us, message us on Telegram or visit the school — we'll welcome you with a cup of tea.",
        "address": "120100, Syrdarya region, Gulistan, Al-Khwarizmi street, 36",
        "phones": ["+998 98 560 07 20"],
        "hours": "Mon–Fri: 08:30–17:30, Sat: 08:30–12:00",
        "map_embed_url": MAP_EMBED,
        "lat": LAT,
        "lng": LNG,
    },
}

THANKS = {
    "uz": {"title": "Rahmat! Arizangiz qabul qilindi.",
           "text": "Menejerimiz 1 ish kuni ichida siz bilan bog'lanadi. Kutish vaqtida Instagram va Telegram kanalimizdan maktab hayotini kuzatib boring.",
           "button": "Bosh sahifaga qaytish"},
    "ru": {"title": "Спасибо! Ваша заявка принята.",
           "text": "Наш менеджер свяжется с вами в течение 1 рабочего дня. Пока ждёте — следите за жизнью школы в нашем Instagram и Telegram-канале.",
           "button": "Вернуться на главную"},
    "en": {"title": "Thank you! Your application has been received.",
           "text": "Our manager will contact you within one business day. Meanwhile, follow school life on our Instagram and Telegram channel.",
           "button": "Back to home"},
}

RESULTS = {
    "uz": {"title": "O'quvchilarimiz natijalari",
           "text": "Har bir sertifikat — haqiqiy o'quvchi va haqiqiy mehnat. Natijalarni o'zingiz tekshirib ko'rishingiz mumkin.",
           "stats_labels": {"ielts_7_plus": "ta IELTS 7.0+", "cefr_b2_c1": "ta CEFR B2–C1", "olympiad_winners": "olimpiada g'olibi", "sat_1300_plus": "ta SAT 1300+"},
           "cta_title": "Farzandingiz ham shunday natijaga erishishini xohlaysizmi?",
           "cta_button": "Qabulga yoziling",
           "privacy_note": "Saytda faqat ota-onasi yozma rozilik bergan o'quvchilarning sertifikatlari ko'rsatiladi."},
    "ru": {"title": "Результаты наших учеников",
           "text": "Каждый сертификат — реальный ученик и реальный труд. Вы можете проверить результаты сами.",
           "stats_labels": {"ielts_7_plus": "IELTS 7.0+", "cefr_b2_c1": "CEFR B2–C1", "olympiad_winners": "победителей олимпиад", "sat_1300_plus": "SAT 1300+"},
           "cta_title": "Хотите, чтобы ваш ребёнок добился таких же результатов?",
           "cta_button": "Записаться на приём",
           "privacy_note": "На сайте публикуются только сертификаты учеников, чьи родители дали письменное согласие."},
    "en": {"title": "Our Students' Results",
           "text": "Every certificate is a real student and real effort. You can verify the results yourself.",
           "stats_labels": {"ielts_7_plus": "IELTS 7.0+", "cefr_b2_c1": "CEFR B2–C1", "olympiad_winners": "Olympiad winners", "sat_1300_plus": "SAT 1300+"},
           "cta_title": "Want your child to achieve results like these?",
           "cta_button": "Apply now",
           "privacy_note": "Only certificates of students whose parents gave written consent are shown on the site."},
}

PARTNERS_PAGE = {
    "uz": {"title": "Dunyoning top-1000 universitetlari bilan hamkorlik",
           "text": "Smart Start QS World University Rankings bo'yicha top-1000 talikka kiruvchi 6 ta xorijiy universitet bilan hamkorlik qiladi. Bu hamkorlik bitiruvchilarimizga qabulda tavsiya, yozgi maktablar va grantlar imkonini beradi.",
           "benefits": ["Qabulda to'g'ridan-to'g'ri tavsiya", "Yozgi maktab yoki onlayn xalqaro kurslar", "Xalqaro grant yoki chegirma imkoniyatlari"]},
    "ru": {"title": "Сотрудничество с топ-1000 университетами мира",
           "text": "Smart Start сотрудничает с 6 зарубежными университетами из топ-1000 рейтинга QS World University Rankings. Это даёт нашим выпускникам рекомендации при поступлении, летние школы и гранты.",
           "benefits": ["Прямая рекомендация при поступлении", "Летние школы и международные онлайн-курсы", "Возможности получения грантов и скидок"]},
    "en": {"title": "Partnership with the World's Top-1000 Universities",
           "text": "Smart Start partners with 6 international universities ranked in the QS World University Rankings top 1000. This gives our graduates admission recommendations, summer schools and scholarships.",
           "benefits": ["Direct recommendation for admission", "Summer schools and international online courses", "Scholarship and tuition discount opportunities"]},
}

PRIVACY = {
    "uz": {"title": "Maxfiylik siyosati", "updated": "2026-11-07", "body": (
        "<p>Smart Start xususiy maktabi (keyingi o'rinlarda — «Maktab») sayt orqali yuborilgan shaxsiy ma'lumotlarni "
        "O'zbekiston Respublikasining «Shaxsga doir ma'lumotlar to'g'risida»gi qonuniga muvofiq qayta ishlaydi.</p>"
        "<h3>Qanday ma'lumotlarni yig'amiz</h3><ul><li>Ota-onaning ismi va telefon raqami;</li>"
        "<li>farzandning ismi, tug'ilgan yili va qabul qilinmoqchi bo'lgan sinfi;</li>"
        "<li>formada qoldirilgan izoh, reklama manbasi (UTM).</li></ul>"
        "<h3>Nima uchun</h3><p>Faqat qabul arizasini ko'rib chiqish, siz bilan bog'lanish va ekskursiyaga yozish uchun.</p>"
        "<h3>Saqlash</h3><p>Ma'lumotlar O'zbekiston hududidagi serverda saqlanadi va faqat ruxsati bor maktab xodimlariga ko'rinadi. "
        "Uchinchi shaxslarga sotilmaydi va berilmaydi.</p>"
        "<h3>O'quvchilar sertifikatlari</h3><p>Saytda faqat ota-onasi yozma rozilik bergan o'quvchilarning sertifikatlari "
        "e'lon qilinadi; hujjat raqamlari va pasport ma'lumotlari yashiriladi.</p>"
        "<h3>Huquqlaringiz</h3><p>Ma'lumotlaringizni ko'rish, tuzatish yoki o'chirishni so'rash uchun +998 98 560 07 20 "
        "raqamiga qo'ng'iroq qiling.</p>")},
    "ru": {"title": "Политика конфиденциальности", "updated": "2026-11-07", "body": (
        "<p>Частная школа Smart Start («Школа») обрабатывает персональные данные, отправленные через сайт, в соответствии "
        "с Законом Республики Узбекистан «О персональных данных».</p>"
        "<h3>Какие данные мы собираем</h3><ul><li>Имя и телефон родителя;</li>"
        "<li>имя ребёнка, год рождения и класс поступления;</li><li>комментарий из формы и источник рекламы (UTM).</li></ul>"
        "<h3>Зачем</h3><p>Только для рассмотрения заявки, связи с вами и записи на экскурсию.</p>"
        "<h3>Хранение</h3><p>Данные хранятся на сервере на территории Узбекистана и доступны только уполномоченным сотрудникам школы. "
        "Мы не продаём и не передаём их третьим лицам.</p>"
        "<h3>Сертификаты учеников</h3><p>На сайте публикуются только сертификаты учеников с письменного согласия родителей; "
        "номера документов и паспортные данные скрываются.</p>"
        "<h3>Ваши права</h3><p>Чтобы просмотреть, исправить или удалить свои данные, позвоните по номеру +998 98 560 07 20.</p>")},
    "en": {"title": "Privacy Policy", "updated": "2026-11-07", "body": (
        "<p>Smart Start Private School (the “School”) processes personal data submitted through this website in accordance "
        "with the Law of the Republic of Uzbekistan “On Personal Data”.</p>"
        "<h3>What we collect</h3><ul><li>Parent's name and phone number;</li>"
        "<li>child's name, year of birth and target grade;</li><li>the comment left in the form and the advertising source (UTM).</li></ul>"
        "<h3>Why</h3><p>Only to review the application, contact you and book school tours.</p>"
        "<h3>Storage</h3><p>Data is stored on a server located in Uzbekistan and is visible only to authorised school staff. "
        "We never sell or share it with third parties.</p>"
        "<h3>Student certificates</h3><p>Only certificates of students whose parents gave written consent are published; "
        "document numbers and passport details are hidden.</p>"
        "<h3>Your rights</h3><p>To view, correct or delete your data, call +998 98 560 07 20.</p>")},
}

PAGES = {
    "home": (HOME, {"uz": ("Smart Start — xususiy maktab", "Farzandingizning kelajagi bugun boshlanadi. Zamonaviy ta'lim, kuchli ingliz tili, kichik sinflar va tajribali o'qituvchilar. 2026–2027 o'quv yiliga qabul ochiq."),
                    "ru": ("Smart Start — частная школа", "Будущее вашего ребёнка начинается сегодня. Современное образование, сильный английский, небольшие классы и опытные педагоги. Открыт приём на 2026–2027 учебный год."),
                    "en": ("Smart Start — Private School", "Your child's future begins today. Modern education, strong English, small classes and experienced teachers. Admissions open for 2026–2027.")}, "@school_entrance"),
    "about": (ABOUT, {"uz": ("Maktab haqida", "Smart Start 2022-yilda ochilgan: bolalarga yod olishni emas, fikrlashni o'rgatamiz."),
                      "ru": ("О школе", "Smart Start открылась в 2022 году: мы учим детей думать, а не зубрить."),
                      "en": ("About", "Smart Start opened in 2022: we teach children to think, not to memorize.")}, "@classroom"),
    "admission": (ADMISSION, {"uz": ("Qabul", "Qabul 4 qadamda: ariza, tanishuv, diagnostik suhbat va shartnoma. Kerakli hujjatlar va narxlar."),
                              "ru": ("Поступление", "Поступление в 4 шага: заявка, знакомство, диагностическая беседа и договор."),
                              "en": ("Admissions", "Admission in 4 steps: application, visit, diagnostic chat and contract.")}, "@school_entrance_family"),
    "contact": (CONTACT, {"uz": ("Aloqa", "Smart Start: Guliston, Al-Xorazmiy ko‘chasi, 36. Telefon +998 98 560 07 20. Du–Ju: 08:30–17:30, Sha: 08:30–12:00."),
                          "ru": ("Контакты", "Smart Start: Гулистан, улица Аль-Хорезми, 36. Телефон +998 98 560 07 20. Пн–Пт: 08:30–17:30, Сб: 08:30–12:00."),
                          "en": ("Contact", "Smart Start: Al-Khwarizmi street 36, Gulistan. Phone +998 98 560 07 20. Mon–Fri: 08:30–17:30, Sat: 08:30–12:00.")}, None),
    "privacy": (PRIVACY, {"uz": ("Maxfiylik siyosati", "Shaxsiy ma'lumotlarni qayta ishlash tartibi."),
                          "ru": ("Политика конфиденциальности", "Порядок обработки персональных данных."),
                          "en": ("Privacy Policy", "How we process personal data.")}, None),
    "thanks": (THANKS, {"uz": ("Rahmat", "Arizangiz qabul qilindi."), "ru": ("Спасибо", "Ваша заявка принята."),
                        "en": ("Thank you", "Your application has been received.")}, None),
    "results": (RESULTS, {"uz": ("O'quvchilarimiz natijalari", "IELTS, CEFR, SAT va fan olimpiadalari bo'yicha Smart Start o'quvchilarining haqiqiy sertifikatlari."),
                          "ru": ("Результаты учеников", "Подлинные сертификаты учеников Smart Start: IELTS, CEFR, SAT и олимпиады."),
                          "en": ("Student Results", "Real certificates of Smart Start students: IELTS, CEFR, SAT and Olympiads.")}, None),
    "partners": (PARTNERS_PAGE, {"uz": ("Hamkor universitetlar", "QS reytingidagi top-1000 universitetlar bilan hamkorlik."),
                                 "ru": ("Вузы-партнёры", "Сотрудничество с университетами из топ-1000 рейтинга QS."),
                                 "en": ("Partner Universities", "Partnership with QS top-1000 universities.")}, None),
}

TEACHERS = [
    {"full_name": "John Miller", "experience_years": 10,
     "subject": ("Ingliz tili (IELTS)", "Английский язык (IELTS)", "English Language (IELTS)"),
     "badge": ("IELTS 8.5", "IELTS 8.5", "IELTS 8.5"),
     "bio": ("O'quvchilarni IELTS va xalqaro imtihonlarga tayyorlaydi. Speaking club yetakchisi.",
             "Готовит учеников к IELTS и международным экзаменам. Ведёт Speaking Club.",
             "Prepares students for IELTS and international exams. Leads the Speaking Club.")},
    {"full_name": "Dr. Rustam Karimov", "experience_years": 14,
     "subject": ("Matematika va SAT", "Математика и SAT", "Mathematics & SAT"),
     "badge": ("SAT 1520", "SAT 1520", "SAT 1520"),
     "bio": ("Yuqori sinflarda matematika va SAT Math tayyorlovi.", "Математика в старших классах и подготовка к SAT Math.",
             "High-school mathematics and SAT Math preparation.")},
    {"full_name": "Dilnoza Rahimova", "experience_years": 12,
     "subject": ("Boshlang'ich sinf", "Начальные классы", "Primary Education"),
     "badge": ("Metodist", "Методист", "Head Teacher"),
     "bio": ("Boshlang'ich sinflar metodisti: savodxonlik, tez o'qish va mental arifmetika.",
             "Методист начальной школы: грамотность, быстрочтение и ментальная арифметика.",
             "Primary methodologist: literacy, speed reading and mental math.")},
    {"full_name": "Alisher Saidov", "experience_years": 15,
     "subject": ("Ona tili va adabiyot", "Родной язык и литература", "Language & Literature"),
     "badge": ("Oliy toifa", "Высшая категория", "Senior Educator"),
     "bio": ("Ona tili va adabiyot o'qituvchisi, oliy toifa.", "Учитель родного языка и литературы высшей категории.",
             "Senior teacher of Uzbek language and literature.")},
]

TESTIMONIALS = [
    {"author": "Gulnora Qosimova", "child_grade": "8",
     "text": ("Farzandim 2 yildan beri Smart Start'da o'qiydi. Ingliz tili darajasi va mustaqil fikrlashi kutilganimdan ancha yuqori bo'ldi. Eng muhimi, har kuni maktabga xursand boradi.",
              "Мой ребёнок учится в Smart Start уже 2 года. Уровень английского и самостоятельность мышления превзошли все ожидания. Самое главное — каждый день идёт в школу с радостью.",
              "My child has been attending Smart Start for 2 years. Their English and independent thinking have exceeded all expectations. Most importantly, they love going to school every day.")},
    {"author": "Botir Zokirov", "child_grade": "5",
     "text": ("Uy vazifasini maktabning o'zida o'qituvchi nazoratida bajarishi bizdek ishlaydigan ota-onalar uchun katta yengillik. Kechqurun uyda dars qildirish stressi yo'q.",
              "Выполнение домашнего задания в самой школе под контролем учителя — огромное облегчение для работающих родителей. Дома по вечерам нет никакого стресса с уроками.",
              "Having homework finished at school under teacher supervision is a huge relief for working parents. No evening stress over unfinished assignments.")},
    {"author": "Nargiza Karimova", "child_grade": "11",
     "text": ("O'tgan yili farzandim IELTS topshirib 7.5 oldi va tuman olimpiadasida 1-o'rinni egalladi. Ustozlarning mehnati va individual yondashuvidan juda minnatdormiz!",
              "В прошлом году наш ребёнок сдал IELTS на 7.5 и занял 1-е место на районной олимпиаде. Мы безмерно благодарны преподавателям за их труд и индивидуальный подход!",
              "Last year my child scored 7.5 on IELTS and won 1st place in the district Olympiad. We are so grateful to the teachers for their dedication and personal approach!")},
]

PARTNERS = [
    {"name": "Oxford International College", "code": "OX", "country_code": "GB", "qs_rank": None, "lat": 51.7520, "lng": -1.2577, "website_url": "",
     "country": ("Buyuk Britaniya", "Великобритания", "United Kingdom")},
    {"name": "Technical University of Munich (TUM)", "code": "TUM", "country_code": "DE", "qs_rank": 28, "lat": 48.1497, "lng": 11.5679, "website_url": "https://www.tum.de",
     "country": ("Germaniya", "Германия", "Germany")},
    {"name": "KAIST", "code": "KAIST", "country_code": "KR", "qs_rank": 56, "lat": 36.3721, "lng": 127.3604, "website_url": "https://www.kaist.ac.kr",
     "country": ("Janubiy Koreya", "Южная Корея", "South Korea")},
    {"name": "University of Bristol", "code": "BRIS", "country_code": "GB", "qs_rank": 54, "lat": 51.4585, "lng": -2.6030, "website_url": "https://www.bristol.ac.uk",
     "country": ("Buyuk Britaniya", "Великобритания", "United Kingdom")},
    {"name": "Politecnico di Milano", "code": "POLI", "country_code": "IT", "qs_rank": 111, "lat": 45.4781, "lng": 9.2272, "website_url": "https://www.polimi.it",
     "country": ("Italiya", "Италия", "Italy")},
    {"name": "University of Warsaw", "code": "UW", "country_code": "PL", "qs_rank": 262, "lat": 52.2403, "lng": 21.0189, "website_url": "https://www.uw.edu.pl",
     "country": ("Polsha", "Польша", "Poland")},
]
PARTNER_DESCRIPTION = (
    "Hamkorlik: qabulda tavsiya, yozgi maktab va grant imkoniyatlari.",
    "Сотрудничество: рекомендация при поступлении, летние школы и гранты.",
    "Partnership: admission recommendation, summer schools and scholarships.",
)

# DEMO values (UZS) — the school must confirm real prices.
PRICES = [
    {"grade_range": "1–4", "monthly_fee": 4_500_000, "meals_fee": 900_000, "transport_fee": 500_000,
     "note": ("Ikkinchi farzand uchun 10% chegirma", "Скидка 10% на второго ребёнка", "10% discount for the second child")},
    {"grade_range": "5–9", "monthly_fee": 5_200_000, "meals_fee": 900_000, "transport_fee": 500_000,
     "note": ("Ingliz tili va to'garaklar narxga kiradi", "Английский и кружки включены в стоимость", "English and clubs are included")},
    {"grade_range": "10–11", "monthly_fee": 5_900_000, "meals_fee": 900_000, "transport_fee": 500_000,
     "note": ("IELTS/SAT tayyorlovi narxga kiradi", "Подготовка к IELTS/SAT включена", "IELTS/SAT preparation is included")},
]

# Questions from the TZ; answers are DEMO values.
FAQS = [
    (("O'quv yili o'rtasida qabul qilasizlarmi?", "Принимаете ли вы в середине учебного года?", "Do you accept students mid-year?"),
     ("Ha, bo'sh joy bo'lsa, istalgan vaqtda.", "Да, при наличии свободных мест — в любое время.", "Yes, at any time if there are free places.")),
    (("Ovqat narxga kiradimi?", "Входит ли питание в стоимость?", "Are meals included in the price?"),
     ("3 mahal issiq ovqat alohida to'lanadi: oyiga 900 000 so'm.", "3-разовое горячее питание оплачивается отдельно: 900 000 сумов в месяц.", "Three hot meals a day are paid separately: 900,000 UZS per month.")),
    (("Transport bormi?", "Есть ли школьный транспорт?", "Is there school transport?"),
     ("Ha, Chilonzor, Yakkasaroy, Sergeli va Uchtepa tumanlaridan. Oyiga 500 000 so'm.", "Да, из Чиланзарского, Яккасарайского, Сергелийского и Учтепинского районов. 500 000 сумов в месяц.", "Yes, from the Chilanzar, Yakkasaray, Sergeli and Uchtepa districts. 500,000 UZS per month.")),
    (("Aka-ukalar uchun chegirma bormi?", "Есть ли скидка для братьев и сестёр?", "Is there a sibling discount?"),
     ("Ikkinchi farzand uchun 10%, uchinchi farzand uchun 15% chegirma.", "Скидка 10% на второго ребёнка и 15% на третьего.", "10% off for the second child and 15% for the third.")),
    (("Darslar soat nechada tugaydi?", "Во сколько заканчиваются уроки?", "What time do lessons end?"),
     ("Asosiy darslar 12:30 gacha, to'liq kun guruhi 18:00 gacha.", "Основные уроки — до 12:30, группа полного дня — до 18:00.", "Core lessons end at 12:30; the full-day group stays until 18:00.")),
]

POSTS = [
    {"slug": "ochiq-eshiklar-kuni-mart-2026", "type": "event", "published": "2026-03-01T09:00:00+05:00",
     "event_date": "2026-03-15T10:00:00+05:00", "cover": "@school_entrance_family",
     "title": ("Ochiq eshiklar kuni — maktabimiz bilan tanishing", "День открытых дверей — познакомьтесь со школой", "Open House Day — Discover Our Campus"),
     "excerpt": ("Ota-onalar uchun maktab bo'ylab ekskursiya, ustozlar bilan ochiq muloqot va namunaviy darslar.",
                 "Экскурсия для родителей по школе, открытый диалог с учителями и показательные уроки.",
                 "Campus tour for prospective families, open dialogue with faculty, and demonstration lessons."),
     "body": ("<p>15-mart kuni Smart Start ochiq eshiklar kunini o'tkazadi. Ota-onalar maktab bo'ylab ekskursiyada sinflar, "
              "laboratoriya va oshxona bilan tanishadi.</p><p>Ustozlar bilan ochiq muloqot va namunaviy darslar bo'lib o'tadi. "
              "Farzandingiz bilan keling — bolalar uchun alohida mashg'ulotlar tayyorlaymiz.</p>",
              "<p>15 марта Smart Start проводит день открытых дверей. Родители познакомятся с классами, лабораторией и столовой.</p>"
              "<p>Вас ждут открытый диалог с учителями и показательные уроки. Приходите с ребёнком — для детей подготовлены отдельные занятия.</p>",
              "<p>On March 15 Smart Start hosts an Open House Day. Parents will tour the classrooms, the lab and the canteen.</p>"
              "<p>Meet our teachers and attend demonstration lessons. Bring your child — we have special activities for kids.</p>")},
    {"slug": "tuman-olimpiadasida-golib", "type": "news", "published": "2026-02-28T12:00:00+05:00", "cover": "@classroom",
     "title": ("O'quvchimiz tuman olimpiadasida g'olib bo'ldi", "Наши ученики победили на районной олимпиаде", "Our Students Triumphed at the District Olympiad"),
     "excerpt": ("Matematika va ingliz tili yo'nalishida 5 nafar o'quvchimiz faxrli 1 va 2-o'rinlarni egalladi.",
                 "5 наших учеников заняли призовые 1 и 2 места по математике и английскому языку.",
                 "5 of our students secured 1st and 2nd places in mathematics and English competitions."),
     "body": ("<p>Tuman fan olimpiadasida matematika va ingliz tili yo'nalishida 5 nafar o'quvchimiz faxrli 1 va 2-o'rinlarni egalladi.</p>"
              "<p>G'oliblarni va ularning ustozlarini tabriklaymiz! Endi ular shahar bosqichiga tayyorlanmoqda.</p>",
              "<p>На районной предметной олимпиаде 5 наших учеников заняли призовые 1 и 2 места по математике и английскому языку.</p>"
              "<p>Поздравляем победителей и их учителей! Теперь ребята готовятся к городскому этапу.</p>",
              "<p>At the district subject Olympiad, 5 of our students won 1st and 2nd places in mathematics and English.</p>"
              "<p>Congratulations to the winners and their teachers! They are now preparing for the city round.</p>")},
    {"slug": "qishki-tatil-jadvali-va-togaraklar", "type": "news", "published": "2026-01-10T10:00:00+05:00", "cover": "@stage_middle",
     "title": ("Qishki ta'til jadvali va qo'shimcha to'garaklar", "Расписание зимних каникул и факультативов", "Winter Break Schedule & Special Workshops"),
     "excerpt": ("Robototexnika va shaxmat bo'yicha qishki oromgoh dasturi tasdiqlandi.",
                 "Утверждена программа зимнего интенсива по робототехнике и шахматам.",
                 "Winter intensive camp program for robotics and chess has been announced."),
     "body": ("<p>Qishki ta'til davomida robototexnika va shaxmat bo'yicha qishki oromgoh dasturi tasdiqlandi.</p>"
              "<p>Mashg'ulotlar maktab binosida, o'qituvchilar nazoratida o'tadi. Ro'yxatdan o'tish uchun sinf rahbariga murojaat qiling.</p>",
              "<p>На зимние каникулы утверждена программа интенсива по робототехнике и шахматам.</p>"
              "<p>Занятия проходят в здании школы под присмотром учителей. Для записи обратитесь к классному руководителю.</p>",
              "<p>A winter intensive camp program for robotics and chess has been approved for the holidays.</p>"
              "<p>Sessions take place at school under teacher supervision. Contact your homeroom teacher to sign up.</p>")},
]

# A DEMO upcoming open-day announcement (date is set by seed.py to the next open-day tour).
UPCOMING_EVENT = {
    "slug": "ochiq-eshiklar-kuni-qabul-2026", "type": "event", "cover": "@school_entrance",
    "title": ("Ochiq eshiklar kuni: 2026–2027 o'quv yiliga qabul", "День открытых дверей: приём на 2026–2027 учебный год", "Open Day: Admissions for 2026–2027"),
    "excerpt": ("Maktab bo'ylab ekskursiya, ustozlar bilan suhbat va qabul shartlari haqida savol-javob.",
                "Экскурсия по школе, беседа с учителями и ответы на вопросы о приёме.",
                "School tour, meet the teachers and get answers about admission."),
    "body": ("<p>2026–2027 o'quv yiliga qabul boshlandi. Ochiq eshiklar kunida maktab bilan tanishing, ustozlar bilan suhbatlashing va "
             "qabul shartlari haqida savollaringizga javob oling.</p><p>Joylar cheklangan — saytda oldindan yoziling.</p>",
             "<p>Начался приём на 2026–2027 учебный год. Приходите на день открытых дверей: познакомьтесь со школой и учителями, "
             "задайте вопросы о приёме.</p><p>Количество мест ограничено — запишитесь заранее на сайте.</p>",
             "<p>Admissions for 2026–2027 are open. Visit our Open Day to see the school, meet the teachers and ask about admission.</p>"
             "<p>Places are limited — book in advance on the website.</p>"),
}

# Personal data (passport/ID number) and reference number are pixelated on the public copy.
CERT_REDACTIONS = {
    101: [{"x": .53, "y": .36, "w": .25, "h": .04}, {"x": .54, "y": .43, "w": .14, "h": .04}],
    102: [{"x": .52, "y": .375, "w": .25, "h": .04}, {"x": .50, "y": .445, "w": .20, "h": .05}],
    103: [{"x": .50, "y": .36, "w": .27, "h": .04}, {"x": .52, "y": .435, "w": .21, "h": .035}],
    104: [{"x": .55, "y": .345, "w": .30, "h": .045}, {"x": .555, "y": .405, "w": .20, "h": .035}],
    105: [{"x": .52, "y": .37, "w": .28, "h": .04}, {"x": .54, "y": .445, "w": .20, "h": .035}],
}
