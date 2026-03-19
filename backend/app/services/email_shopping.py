"""
Email Service Extensions for Shopping Lists
"""
from typing import Optional, Dict, Any
from app.services.email import EmailService, email_service
from app.core.logging import logger


class ShoppingEmailService(EmailService):
    """Extended email service for shopping list reminders"""

    async def send_shopping_reminder(
        self,
        user_email: str,
        user_name: Optional[str],
        reminder_data: Dict[str, Any],
    ) -> bool:
        """
        שולח תזכורת לרשימת קניות

        Args:
            user_email: Email address
            user_name: User's name (optional)
            reminder_data: Dictionary with:
                - list_name: str
                - description: str
                - total_items: int
                - remaining_items: int
                - progress_percentage: float
                - reminder_time: str
                - unchecked_by_category: Dict[str, List[Dict]]

        Returns:
            bool: True if successful
        """
        try:
            subject = f"🛒 תזכורת: {reminder_data['list_name']}"

            # Create email body (plain text)
            body = f"""
שלום {user_name or 'משתמש יקר'},

זו תזכורת לרשימת הקניות שלך: {reminder_data['list_name']}

📊 סטטוס:
• סה"כ פריטים: {reminder_data['total_items']}
• נותרו לקנות: {reminder_data['remaining_items']}
• התקדמות: {reminder_data['progress_percentage']:.1f}%

📝 פריטים שנותרו לקנות:
"""

            for category, items in reminder_data.get('unchecked_by_category', {}).items():
                body += f"\n{category}:\n"
                for item in items:
                    quantity = f" ({item['quantity']})" if item.get('quantity') else ""
                    fixed = " [קבוע]" if item.get('is_fixed') else ""
                    body += f"  • {item['name']}{quantity}{fixed}\n"

            body += f"""
⏰ תזכורת נקבעה ל: {reminder_data['reminder_time']}

בהצלחה בקניות! 🛍️

---
אלי מאור – סידור וארגון הבית
"""

            # Create HTML body (prettier)
            body_html = f"""
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f5f5f5;
            margin: 0;
            padding: 20px;
        }}
        .container {{
            max-width: 600px;
            margin: 0 auto;
            background-color: white;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }}
        .header {{
            background: linear-gradient(135deg, #76C893 0%, #52B788 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }}
        .header h1 {{
            margin: 0;
            font-size: 28px;
        }}
        .content {{
            padding: 30px;
        }}
        .stats {{
            background-color: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }}
        .stat-item {{
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #dee2e6;
        }}
        .stat-item:last-child {{
            border-bottom: none;
        }}
        .progress-bar {{
            background-color: #e9ecef;
            border-radius: 10px;
            height: 25px;
            overflow: hidden;
            margin-top: 10px;
        }}
        .progress-fill {{
            background: linear-gradient(90deg, #52B788, #76C893);
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            transition: width 0.3s ease;
        }}
        .category {{
            margin: 20px 0;
        }}
        .category-title {{
            background-color: #e3f2fd;
            padding: 10px 15px;
            border-right: 4px solid #2196F3;
            font-weight: bold;
            color: #1565C0;
        }}
        .item-list {{
            list-style: none;
            padding: 0;
            margin: 10px 0;
        }}
        .item-list li {{
            padding: 8px 15px;
            border-bottom: 1px solid #f0f0f0;
        }}
        .item-list li:before {{
            content: "▪ ";
            color: #52B788;
            font-weight: bold;
            margin-left: 5px;
        }}
        .badge {{
            display: inline-block;
            padding: 3px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: bold;
            margin-right: 5px;
        }}
        .badge-fixed {{
            background-color: #fff3cd;
            color: #856404;
        }}
        .footer {{
            background-color: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #6c757d;
            font-size: 14px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🛒 תזכורת קניות</h1>
            <p style="margin: 10px 0 0 0; font-size: 18px;">{reminder_data['list_name']}</p>
        </div>

        <div class="content">
            <p style="font-size: 16px; color: #333;">שלום {user_name or 'משתמש יקר'},</p>
            <p style="font-size: 16px; color: #666;">זו תזכורת לרשימת הקניות שלך!</p>

            <div class="stats">
                <div class="stat-item">
                    <span><strong>סה"כ פריטים:</strong></span>
                    <span>{reminder_data['total_items']}</span>
                </div>
                <div class="stat-item">
                    <span><strong>נותרו לקנות:</strong></span>
                    <span style="color: #dc3545; font-weight: bold;">{reminder_data['remaining_items']}</span>
                </div>
                <div class="stat-item">
                    <span><strong>התקדמות:</strong></span>
                    <span>{reminder_data['progress_percentage']:.1f}%</span>
                </div>
            </div>

            <div class="progress-bar">
                <div class="progress-fill" style="width: {reminder_data['progress_percentage']}%;">
                    {reminder_data['progress_percentage']:.0f}%
                </div>
            </div>

            <h3 style="color: #333; margin-top: 30px;">📝 פריטים שנותרו לקנות:</h3>
"""

            for category, items in reminder_data.get('unchecked_by_category', {}).items():
                body_html += f"""
            <div class="category">
                <div class="category-title">{category}</div>
                <ul class="item-list">
"""
                for item in items:
                    quantity = f" ({item['quantity']})" if item.get('quantity') else ""
                    fixed_badge = '<span class="badge badge-fixed">קבוע</span>' if item.get('is_fixed') else ''
                    body_html += f"""
                    <li>{item['name']}{quantity} {fixed_badge}</li>
"""
                body_html += """
                </ul>
            </div>
"""

            body_html += f"""
            <p style="margin-top: 30px; padding: 15px; background-color: #fff3cd; border-right: 4px solid #ffc107; border-radius: 5px;">
                ⏰ <strong>תזכורת נקבעה ל:</strong> {reminder_data['reminder_time']}
            </p>

            <p style="text-align: center; margin-top: 30px; font-size: 18px;">
                בהצלחה בקניות! 🛍️
            </p>
        </div>

        <div class="footer">
            <p style="margin: 0;">אלי מאור – סידור וארגון הבית</p>
            <p style="margin: 5px 0 0 0; font-size: 12px;">תזכורת אוטומטית מהמערכת</p>
        </div>
    </div>
</body>
</html>
"""

            # Send email
            success = await self.send_email(
                recipients=[user_email],
                subject=subject,
                body=body,
                body_html=body_html,
            )

            return success

        except Exception as e:
            logger.error(f"Error sending shopping reminder email: {e}", exc_info=True)
            return False


    async def send_shopping_summary(
        self,
        user_email: str,
        user_name: Optional[str],
        summary_data: Dict[str, Any],
    ) -> bool:
        """
        שולח סיכום של רשימת קניות שהושלמה

        Args:
            user_email: Email address
            user_name: User's name (optional)
            summary_data: Dictionary with:
                - list_name: str
                - completed_at: str
                - total_items: int
                - checked_items: int
                - categories: Dict[str, Dict]

        Returns:
            bool: True if successful
        """
        try:
            subject = f"✅ סיכום קניות: {summary_data['list_name']}"

            # Create email body (plain text)
            body = f"""
שלום {user_name or 'משתמש יקר'},

סיימת את הקניות! 🎉

📊 סיכום:
• רשימה: {summary_data['list_name']}
• הושלמה: {summary_data['completed_at']}
• סה"כ פריטים: {summary_data['total_items']}
• נקנו: {summary_data['checked_items']}

כל הכבוד! 👏

---
אלי מאור – סידור וארגון הבית
"""

            # Create HTML body
            completion_rate = (summary_data['checked_items'] / summary_data['total_items'] * 100) if summary_data['total_items'] > 0 else 0

            body_html = f"""
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
    <meta charset="UTF-8">
    <style>
        body {{ font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px; }}
        .container {{ max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
        .header {{ background: linear-gradient(135deg, #52B788, #76C893); color: white; padding: 30px; text-align: center; }}
        .content {{ padding: 30px; }}
        .success-icon {{ font-size: 60px; text-align: center; margin: 20px 0; }}
        .stats {{ background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; }}
        .stat-item {{ display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #dee2e6; }}
        .completion {{ text-align: center; font-size: 24px; color: #52B788; font-weight: bold; margin: 20px 0; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✅ סיכום קניות</h1>
        </div>
        <div class="content">
            <div class="success-icon">🎉</div>
            <h2 style="text-align: center; color: #333;">כל הכבוד! סיימת את הקניות!</h2>

            <div class="stats">
                <div class="stat-item">
                    <strong>רשימה:</strong>
                    <span>{summary_data['list_name']}</span>
                </div>
                <div class="stat-item">
                    <strong>הושלמה:</strong>
                    <span>{summary_data['completed_at']}</span>
                </div>
                <div class="stat-item">
                    <strong>סה"כ פריטים:</strong>
                    <span>{summary_data['total_items']}</span>
                </div>
                <div class="stat-item">
                    <strong>נקנו:</strong>
                    <span>{summary_data['checked_items']}</span>
                </div>
            </div>

            <div class="completion">
                {completion_rate:.0f}% הושלם!
            </div>

            <p style="text-align: center; color: #666; margin-top: 30px;">
                תודה שהשתמשת במערכת! 🛍️
            </p>
        </div>
    </div>
</body>
</html>
"""

            # Send email
            success = await self.send_email(
                recipients=[user_email],
                subject=subject,
                body=body,
                body_html=body_html,
            )

            return success

        except Exception as e:
            logger.error(f"Error sending shopping summary email: {e}", exc_info=True)
            return False


# Export singleton instance
shopping_email_service = ShoppingEmailService()


# Monkey-patch email_service to add shopping methods
email_service.send_shopping_reminder = shopping_email_service.send_shopping_reminder
email_service.send_shopping_summary = shopping_email_service.send_shopping_summary
