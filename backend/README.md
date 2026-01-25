# Ramadan Iftar Booking Backend API

A Node.js/Express backend API for the Ramadan Iftar Booking System with MongoDB database and JWT authentication.

## 🚀 Features

- **RESTful API** for reservation management
- **MongoDB** database with Mongoose ODM
- **JWT Authentication** for admin access
- **Input validation** with express-validator
- **Security middleware** (Helmet, CORS, Rate limiting)
- **Error handling** and logging
- **Multi-environment** configuration

## 📋 Prerequisites

- Node.js (v14 or higher)
- MongoDB (local installation or cloud service like MongoDB Atlas)
- npm or yarn

## 🛠️ Installation

1. **Navigate to backend directory:**

   ```bash
   cd backend
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Environment Setup:**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your configuration values.

4. **Start MongoDB:**
   Make sure MongoDB is running on your system.

5. **Setup Admin User:**
   ```bash
   npm run setup
   ```
   This creates a default admin user (username: `admin`, password: `admin123`).

## 🚀 Running the Application

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

The server will start on `http://localhost:5000` (or your configured PORT).

## 📚 API Endpoints

### Authentication

- `POST /api/auth/login` - Admin login
- `GET /api/auth/me` - Get current admin info (requires auth)
- `POST /api/auth/logout` - Logout (requires auth)

### Reservations

- `POST /api/reservations` - Create new reservation
- `GET /api/reservations` - Get all reservations (admin only)
- `GET /api/reservations/:id` - Get reservation by ID (admin only)
- `PUT /api/reservations/:id` - Update reservation (admin only)
- `DELETE /api/reservations/:id` - Delete reservation (admin only)
- `GET /api/reservations/check/:phone/:date` - Check for duplicate reservation

### Health Check

- `GET /api/health` - Server health status

## 🔐 Authentication

Admin endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## 📊 Data Models

### Reservation

```javascript
{
  id: Number,           // Unique reservation ID
  name: String,         // Customer name
  phone: String,        // Phone number
  date: String,         // Date (YYYY-MM-DD)
  people: Number,       // Number of people
  group: Boolean,       // Group booking flag
  status: String,       // Status (قيد الانتظار, تم التأكيد, ملغي)
  createdAt: Date,      // Creation timestamp
  updatedAt: Date       // Update timestamp
}
```

### Admin

```javascript
{
  username: String,     // Login username
  password: String,     // Hashed password
  name: String,         // Display name
  role: String,         // Role (admin, superadmin)
  isActive: Boolean,    // Account status
  createdAt: Date,      // Creation timestamp
  updatedAt: Date       // Update timestamp
}
```

## 🧪 Testing the API

### Login as Admin

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'
```

### Create Reservation

```bash
curl -X POST http://localhost:5000/api/reservations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "أحمد علي",
    "phone": "0501234567",
    "date": "2024-03-15",
    "people": 4,
    "group": false
  }'
```

### Get All Reservations (Admin)

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:5000/api/reservations
```

## 🔧 Configuration

### Environment Variables

| Variable                 | Description               | Default                                     |
| ------------------------ | ------------------------- | ------------------------------------------- |
| `PORT`                   | Server port               | `5000`                                      |
| `NODE_ENV`               | Environment               | `development`                               |
| `MONGODB_URI`            | MongoDB connection string | `mongodb://localhost:27017/ramadan-booking` |
| `JWT_SECRET`             | JWT signing secret        | `your-secret-key`                           |
| `FRONTEND_URL`           | Frontend URL for CORS     | `http://localhost:3000`                     |
| `DEFAULT_ADMIN_USERNAME` | Default admin username    | `admin`                                     |
| `DEFAULT_ADMIN_PASSWORD` | Default admin password    | `admin123`                                  |

## 🚀 Deployment

### Environment Setup

1. Set `NODE_ENV=production`
2. Use a production MongoDB instance
3. Set a strong `JWT_SECRET`
4. Configure proper CORS settings

### Process Management

Consider using PM2 for production:

```bash
npm install -g pm2
pm2 start server.js --name "ramadan-booking-api"
```

## 📝 Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm run setup` - Initialize admin user

## 🔒 Security Features

- **Helmet.js** - Security headers
- **CORS** - Cross-origin resource sharing control
- **Rate Limiting** - API request throttling
- **Input Validation** - Request data validation
- **JWT Authentication** - Secure admin access
- **Password Hashing** - bcrypt for password security

## 🐛 Error Handling

The API provides consistent error responses:

```json
{
  "message": "Error description",
  "errors": ["Detailed error messages"] // for validation errors
}
```

## 📞 Support

For issues or questions, please check the application logs and ensure all environment variables are properly configured.

## 📄 License

This project is licensed under the ISC License.
