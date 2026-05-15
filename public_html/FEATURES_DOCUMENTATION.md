# Hikers Horizon - New Features Documentation

## Overview
I've added three major features to your Hikers Horizon project:

1. **User Profile Page** (`profile.html`)
2. **Email Verification** (`verify-email.html`)  
3. **Admin Dashboard** (`admin-dashboard.html`)

## Getting Started

### Prerequisites
Before using these features, you need to install Node.js and MongoDB:

1. **Install Node.js**: https://nodejs.org/
2. **Install MongoDB Community**: https://www.mongodb.com/try/download/community
3. **Start MongoDB Service** (Windows):
   - Open Command Prompt as Administrator
   - Run: `net start MongoDB`

### Setup

1. Navigate to your project folder:
```
cd c:\Users\Shiva\OneDrive\Desktop\HH Project
```

2. Install dependencies:
```
npm install
```

3. Start the server:
```
node server.js
```

4. Open your browser and go to:
```
http://localhost:8080
```

## Features

### 1. User Profile Page (`profile.html`)

**URL**: `http://localhost:8080/profile.html`

**Features**:
- View your account information (username, email, member since date)
- See email verification status
- View all your bookings with details (trek name, date, participants, cost)
- Edit your profile (change username)
- Logout button

**How to Access**:
1. Sign up at `signup.html`
2. Log in at `login.html`
3. You'll be automatically redirected to your profile

**Data Stored**:
- User email is saved in browser's localStorage
- Profile data is fetched from MongoDB backend

### 2. Email Verification (`verify-email.html`)

**URL**: `http://localhost:8080/verify-email.html`

**Features**:
- Simulated email verification process
- Users enter their email to verify their account
- Once verified, users can access all features
- Verification status shown as badge on profile

**How It Works**:
- When users sign up, they can visit verify-email.html
- They enter their email and click "Verify"
- The system marks them as verified in the database
- Verified status appears on their profile

**Backend Route**: `POST /verify-email/:email`

### 3. Admin Dashboard (`admin-dashboard.html`)

**URL**: `http://localhost:8080/admin-dashboard.html`

**Features**:
- **Statistics Dashboard**:
  - Total users count
  - Verified vs unverified users
  - Total bookings
  - Total revenue

- **User Management**:
  - View all registered users
  - See verification status for each user
  - Delete users (requires admin password)
  - Sort and manage users

- **Bookings Overview**:
  - View all bookings from all users
  - See trek details, dates, participants
  - Monitor revenue

**Admin Password**: 
- By default, the system checks for an admin account
- To create an admin account, manually add to MongoDB:
  ```
  {
    "username": "admin",
    "email": "admin@hikershorizon.com",
    "password": "hashed-password",
    "verified": true
  }
  ```

## Backend API Routes

### User Routes
- `POST /signup` - Create new user account
- `POST /login` - Login and get user details
- `GET /users` - Get all users (admin)
- `GET /profile/:email` - Get user profile with bookings
- `PUT /profile/:email` - Update user profile
- `DELETE /admin/users/:email` - Delete user (admin only)

### Email Route
- `POST /verify-email/:email` - Mark email as verified

### Admin Routes
- `GET /admin/stats` - Get dashboard statistics

### Booking Routes
- `POST /book` - Create new booking
- `GET /bookings/:email` - Get user's bookings
- `GET /all-bookings` - Get all bookings (admin)

## Database Schema

### User Schema
```javascript
{
  username: String,
  email: String (unique),
  password: String (hashed),
  verified: Boolean (default: false),
  createdAt: Date (default: now)
}
```

### Booking Schema
```javascript
{
  userEmail: String,
  trekName: String,
  bookingDate: Date,
  participants: Number,
  totalCost: Number
}
```

## File Structure

```
HH Project/
├── index.html (updated with new navigation)
├── login.html (updated with localStorage)
├── signup.html (updated)
├── profile.html (NEW)
├── verify-email.html (NEW)
├── admin-dashboard.html (NEW)
├── server.js (updated with new routes)
├── package.json (NEW)
└── ...rest of files
```

## Navigation

From the main index page, users can now:
1. Click **Login** → Login page
2. Click **Profile** → User profile (requires login)
3. Click **Admin** → Admin dashboard (requires admin credentials)

## Security Notes

⚠️ **Important**: This is a development setup. For production:

1. **Passwords**: Implement proper JWT tokens instead of storing emails in localStorage
2. **Admin Access**: Use proper admin role system instead of password verification
3. **Email Verification**: Integrate with email service (SendGrid, Gmail, etc.)
4. **Database**: Use environment variables for MongoDB connection
5. **HTTPS**: Always use HTTPS in production
6. **CORS**: Configure CORS properly for your domain

## Troubleshooting

### Server won't start
- Ensure MongoDB is running: `net start MongoDB` (Windows admin)
- Check if port 8080 is available
- Verify Node.js is installed: `node --version`

### Can't access profile page
- Make sure you're logged in (check localStorage in browser DevTools)
- Check if server is running on http://localhost:8080

### Admin dashboard not loading
- Verify all users have been created in MongoDB
- Check browser console for API errors

### Database connection issues
- Ensure MongoDB service is running
- Check connection string in server.js

## Next Steps

Consider adding:
- Email notifications
- Payment integration (Razorpay, Stripe)
- Trek booking system
- Review and rating system
- Advanced admin features (analytics, reports)
- User authentication with JWT
- Two-factor authentication

## Support

For issues or questions, check:
1. Browser console (F12) for error messages
2. Server logs in terminal
3. MongoDB logs

---

**Created**: March 31, 2026
**Version**: 1.0.0
