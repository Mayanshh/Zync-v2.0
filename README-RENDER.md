
# Deploying Zync Backend on Render

## Prerequisites
1. A Render account (free tier available)
2. A MongoDB Atlas database
3. Your frontend deployed separately (or static files served from this backend)

## Deployment Steps

### 1. Create a New Web Service
- Go to [Render Dashboard](https://dashboard.render.com)
- Click "New" → "Web Service"
- Connect your GitHub repository

### 2. Configure Build Settings
- **Name**: `zync-backend`
- **Environment**: `Node`
- **Region**: Choose closest to your users
- **Branch**: `main` (or your deployment branch)
- **Root Directory**: `backend`
- **Build Command**: `npm install`
- **Start Command**: `npm run render-start`

### 3. Set Environment Variables
Add these environment variables in Render dashboard:

**Required:**
- `NODE_ENV`: `production`
- `PORT`: `10000`
- `MONGODB_URI`: Your MongoDB connection string
- `SESSION_SECRET`: Random secure string

**Optional but Recommended:**
- `FRONTEND_URL`: Your frontend domain
- `BASE_URL`: Your Render service URL
- `EMAIL_USER`: Gmail for password reset
- `EMAIL_PASS`: Gmail app password
- `VAPID_PUBLIC_KEY`: For push notifications
- `VAPID_PRIVATE_KEY`: For push notifications
- `VAPID_EMAIL`: Your email for VAPID
- `ADMIN_USERNAME`: Admin panel username
- `ADMIN_PASSWORD_HASH`: SHA256 hash of admin password
- `ADMIN_TOKEN_SECRET`: Random secure string

### 4. Deploy
- Click "Create Web Service"
- Render will automatically deploy your app
- Your backend will be available at: `https://your-service-name.onrender.com`

## Important Notes

1. **Free Tier Limitations**: Render free tier spins down after 15 minutes of inactivity
2. **Database**: Use MongoDB Atlas (free tier available)
3. **Frontend**: Deploy separately or serve static files from this backend
4. **HTTPS**: Render provides free SSL certificates
5. **Health Check**: The app includes a `/health` endpoint for monitoring

## Testing Your Deployment

1. Visit `https://your-service-name.onrender.com/health`
2. You should see a JSON response with server status
3. Visit `https://your-service-name.onrender.com/api` for API info

## Troubleshooting

- Check the Render logs for any startup errors
- Ensure all required environment variables are set
- Verify your MongoDB connection string is correct
- Make sure your frontend is configured to use the correct backend URL
