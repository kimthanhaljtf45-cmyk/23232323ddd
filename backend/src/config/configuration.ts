export default () => {
  // Support both MONGO_URL and MONGO_URI for compatibility
  const mongoUrl = process.env.MONGO_URL || process.env.MONGO_URI || 'mongodb://localhost:27017';
  const dbName = process.env.DB_NAME || 'test_database';
  const mongoUri = mongoUrl.includes('?') ? mongoUrl : `${mongoUrl}/${dbName}`;
  console.log('🔗 Database URI:', mongoUri);
  
  return {
    port: parseInt(process.env.PORT || '3001', 10),
    mongo: {
      uri: mongoUri,
    },
    jwt: {
      accessSecret: process.env.JWT_ACCESS_SECRET || 'access_secret',
      refreshSecret: process.env.JWT_REFRESH_SECRET || 'refresh_secret',
      accessExpires: process.env.JWT_ACCESS_EXPIRES || '7d',
      refreshExpires: process.env.JWT_REFRESH_EXPIRES || '30d',
    },
  };
};
