import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  PORT: Joi.number().default(8001),
  MONGO_URI: Joi.string().default('mongodb://localhost:27017/sports_miniapp'),
  JWT_ACCESS_SECRET: Joi.string().default('access_secret'),
  JWT_REFRESH_SECRET: Joi.string().default('refresh_secret'),
  JWT_ACCESS_EXPIRES: Joi.string().default('7d'),
  JWT_REFRESH_EXPIRES: Joi.string().default('30d'),
});
