# 🏔️ Hikers Horizon - Adventure Awaits

**Hikers Horizon** is a comprehensive trekking and adventure booking platform designed to connect adventure seekers with breathtaking experiences across India. From sunrise treks to multi-day backpacking trips, our platform provides a seamless booking experience, user profiles, and an administrative dashboard for trip management.

---

## 🚀 Features

### For Users
- **Explore Treks:** Browse a wide variety of trekking categories:
  - 🌅 **Sunrise Treks:** Anthargange, Skandagiri, Savandurga, and more.
  - 🎒 **Backpacking Trips:** Chikmagalur, Hampi, Wayanad, Coorg.
  - ⛰️ **Multi-day Treks:** Kumara Parvatha, Kudremukha, Kodachadri.
- **Secure Authentication:** 
  - Signup and Login with **OTP Verification** (via Email/Mock SMS).
  - Password hashing for security.
- **User Profile:**
  - View account details and membership status.
  - Track all personal bookings and total expenditure.
  - Edit profile information.
- **Instant Booking:** User-friendly booking forms for each destination with automatic cost calculation.

### For Administrators
- **Stats Dashboard:** Real-time metrics on total users, verified users, total bookings, and revenue.
- **User Management:** View all registered users, monitor verification status, and manage account deletions.
- **Booking Overview:** Access a consolidated view of all bookings made across the platform.

---

## 🛠️ Tech Stack

- **Frontend:** HTML5, CSS3 (Vanilla), JavaScript (ES6+), FontAwesome.
- **Backend:** Node.js, Express.js.
- **Database:** MongoDB (Mongoose ODM).
- **Communication:** Nodemailer (Email OTPs), Fast2SMS (SMS Gateway integration).
- **Security:** Bcrypt.js (Password hashing), CORS, Body-parser.

---

## 📦 Prerequisites

Before running the project, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v14+ recommended)
- [MongoDB Community Server](https://www.mongodb.com/try/download/community)
- [Git](https://git-scm.com/)

---

## ⚙️ Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd hikers-horizon
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root directory and add the following:
   ```env
   PORT=8080
   MONGODB_URI=mongodb://localhost:27017/hikershorizon
   
   # Email Configuration (for OTPs)
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-app-specific-password
   MOCK_EMAIL=true # Set to 'false' for real emails
   
   # SMS Configuration
   FAST2SMS_API_KEY=your_api_key_here
   ```

4. **Start MongoDB:**
   Ensure your MongoDB service is running:
   - **Windows:** `net start MongoDB`
   - **Linux/macOS:** `sudo systemctl start mongod`

5. **Run the server:**
   ```bash
   npm start
   ```

6. **Access the application:**
   Open your browser and navigate to `http://localhost:8080`.

---

## 📂 Project Structure

```text
Hikers_Proj/
├── 📄 server.js              # Express backend and API routes
├── 📄 index.html             # Landing page
├── 📁 Sunrise/               # Sunrise trek details
├── 📁 Backpacking/           # Backpacking trip details
├── 📁 Twodays/               # Two-day trek details
├── 📄 profile.html           # User profile management
├── 📄 admin-dashboard.html   # Admin management panel
├── 📄 auth-navigation.js     # Shared authentication UI logic
└── 📄 FEATURES_DOCUMENTATION.md # Detailed feature breakdown
```

---

## 🛡️ Security Note
This project is currently in a **development state**. For production deployment:
- Implement **JWT (JSON Web Tokens)** for session management.
- Use **Environment Variables** for all secrets.
- Enable **HTTPS** for secure communication.
- Implement proper **Admin RBAC** (Role-Based Access Control).

---

## 🤝 Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Contact
For any inquiries or feedback, please reach out to:
- **Project Lead:** Anil
- **Email:** hikershorizon@gmail.com

---
*Developed with ❤️ for the trekking community.*
