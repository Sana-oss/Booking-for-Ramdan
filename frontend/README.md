# Ramadan Booking System

A complete web application for managing Ramadan Iftar reservations with both frontend and backend components.

## 🌟 Features

- **Frontend**: Responsive booking form with Arabic/English support
- **Backend**: RESTful API with MongoDB database
- **Admin Panel**: Secure admin dashboard for managing reservations
- **Real-time Sync**: Multi-tab synchronization
- **Offline Support**: Falls back to localStorage when API unavailable
- **Security**: JWT authentication, input validation, rate limiting

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- Git

### Installation

1. **Clone the repository**

   ```bash
   git clone <your-repo-url>
   cd booking-for-ramdan
   ```

2. **Setup Backend**

   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Edit .env with your MongoDB URI and other settings
   npm run setup  # Creates default admin user
   npm run dev    # Starts development server
   ```

3. **Setup Frontend**
   ```bash
   # Open index.html in browser or serve with any static server
   # Backend runs on http://localhost:5000
   ```

## 📋 Deployment

### Option 1: GitHub Pages + Heroku (Free)

1. **Deploy Frontend to GitHub Pages**

   ```bash
   chmod +x deploy-frontend.sh
   ./deploy-frontend.sh
   # Follow the instructions in the script
   ```

2. **Deploy Backend to Heroku**
   ```bash
   chmod +x deploy-backend.sh
   ./deploy-backend.sh
   # Follow the instructions in the script
   ```

### Option 2: Docker (Recommended for Production)

```bash
# Build and run with Docker Compose
docker-compose up -d

# Or build manually
docker build -t ramadan-booking .
docker run -p 5000:5000 ramadan-booking
```

### Option 3: Manual Deployment

- **Frontend**: Upload files to any web hosting (Netlify, Vercel, etc.)
- **Backend**: Deploy to Heroku, Railway, DigitalOcean, etc.

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the backend directory:

```env
PORT=5000
NODE_ENV=production
MONGODB_URI=mongodb://localhost:27017/ramadan-booking
JWT_SECRET=your-super-secret-jwt-key
FRONTEND_URL=https://your-frontend-domain.com
```

### Default Admin Credentials

- **Username**: admin
- **Password**: admin123

Change these after first login!

## 📚 API Documentation

### Authentication

- `POST /api/auth/login` - Admin login
- `GET /api/auth/me` - Get current admin info
- `POST /api/auth/logout` - Logout

### Reservations

- `POST /api/reservations` - Create reservation
- `GET /api/reservations` - Get all reservations (admin)
- `GET /api/reservations/:id` - Get reservation by ID
- `PUT /api/reservations/:id` - Update reservation
- `DELETE /api/reservations/:id` - Delete reservation
- `GET /api/reservations/check/:phone/:date` - Check duplicates

## 🧪 Testing

### API Testing with cURL

```bash
# Create reservation
curl -X POST http://localhost:5000/api/reservations \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","phone":"0501234567","date":"2024-03-15","people":4}'

# Admin login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

## 🏗️ Project Structure

```
booking-for-ramdan/
├── backend/                 # Express.js API server
│   ├── config/             # Database configuration
│   ├── middleware/         # Authentication middleware
│   ├── models/             # MongoDB schemas
│   ├── routes/             # API endpoints
│   ├── server.js           # Main server file
│   └── package.json        # Backend dependencies
├── *.html                  # Frontend pages
├── *.js                    # Frontend JavaScript
├── *.css                   # Stylesheets
├── i18n.js                 # Internationalization
├── deploy-*.sh             # Deployment scripts
├── docker-compose.yml      # Docker configuration
├── Dockerfile              # Docker build file
└── README.md               # This file
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

If you encounter any issues:

1. Check the troubleshooting section in backend/README.md
2. Verify your environment variables
3. Ensure MongoDB is running
4. Check the browser console for frontend errors
5. Check server logs for backend errors

## 🎯 Roadmap

- [ ] Email notifications for reservations
- [ ] SMS integration
- [ ] Advanced reporting and analytics
- [ ] Mobile app
- [ ] Multi-language admin panel
- [ ] Reservation calendar view

---

Made with ❤️ for Ramadan
