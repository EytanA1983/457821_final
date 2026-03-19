# Task vs Todo - הגדרה ברורה

## Task (משימות)
**משימות עם תאריך יעד, חדר, וטווח זמן**

### תכונות:
- ✅ `due_date` - תאריך יעד
- ✅ `room_id` - קשר לחדר
- ✅ `scope` - טווח זמן (today/week)
- ✅ `recurrence` - חזרתיות (daily/weekly/monthly)
- ✅ `category_id` - קטגוריה
- ✅ `completed` - סטטוס השלמה

### Endpoints:
- `GET /api/tasks` - רשימת משימות (עם filters: scope, room_id, completed)
- `GET /api/tasks/today` - משימות היום
- `GET /api/tasks/weekly` - משימות השבוע
- `POST /api/tasks` - יצירת משימה
- `PATCH /api/tasks/{id}` - עדכון משימה

### שימוש:
- משימות יומיות/שבועיות
- משימות לפי חדר
- משימות עם תאריך יעד
- משימות חוזרות

---

## Todo (רשימות משנה)
**Sub-tasks של Task - רשימות משנה בתוך משימה**

### תכונות:
- ✅ `task_id` - קשר ל-Task
- ✅ `title` - כותרת
- ✅ `completed` - סטטוס השלמה
- ✅ `position` - סדר תצוגה

### Endpoints:
- `GET /api/todos/task/{task_id}` - רשימת todos של task
- `POST /api/todos?task_id={id}` - יצירת todo
- `PUT /api/todos/{id}` - עדכון todo
- `PUT /api/todos/{id}/complete` - סמן כהושלם
- `DELETE /api/todos/{id}` - מחיקת todo

### שימוש:
- רשימות משנה בתוך משימה
- צ'קליסטים קטנים
- שלבי ביצוע של משימה

---

## ShoppingList (רשימות קניות)
**רשימות קניות/מכולת - אוספים כלליים**

### תכונות:
- ✅ `name` - שם הרשימה
- ✅ `room_id` - קשר לחדר (אופציונלי)
- ✅ `is_template` - תבנית לשימוש חוזר
- ✅ `items` - פריטי קנייה

### Endpoints:
- `GET /api/shopping` - רשימת רשימות קניות
- `POST /api/shopping` - יצירת רשימת קניות
- `GET /api/shopping/{id}` - פרטי רשימה
- `POST /api/shopping/{id}/items` - הוספת פריט

### שימוש:
- רשימות קניות
- רשימות מכולת
- אוספים כלליים

---

## סיכום

| Feature | Task | Todo | ShoppingList |
|---------|------|------|--------------|
| **תכלית** | משימות עם תאריך יעד | Sub-tasks של Task | רשימות קניות |
| **due_date** | ✅ | ❌ | ❌ |
| **room_id** | ✅ | ❌ | ✅ (אופציונלי) |
| **scope** | ✅ (today/week) | ❌ | ❌ |
| **recurrence** | ✅ | ❌ | ❌ |
| **קשר ל-Task** | ❌ | ✅ | ❌ |
| **template** | ❌ | ❌ | ✅ |

---

## המלצות שימוש

### Task - מתי להשתמש?
- משימה עם תאריך יעד
- משימה שקשורה לחדר
- משימה יומית/שבועית
- משימה חוזרת

### Todo - מתי להשתמש?
- רשימת משנה בתוך Task
- צ'קליסט של שלבים
- רשימת פעולות קטנות

### ShoppingList - מתי להשתמש?
- רשימת קניות
- רשימת מכולת
- אוסף פריטים כללי
