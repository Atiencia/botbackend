import winston from 'winston';
import path from 'path';

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(
    (info) => `[${info.timestamp}] ${info.level.toUpperCase()}: ${info.message}`
  )
);

// Create the logger instance
export const logger = winston.createLogger({
  level: 'info',
  format: logFormat,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    })
  ],
});

// Solo agregar logs físicos si estamos en desarrollo local
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.File({ filename: path.join(__dirname, '../../logs/error.log'), level: 'error' }));
  logger.add(new winston.transports.File({ filename: path.join(__dirname, '../../logs/meta.log'), level: 'info' }));
  logger.add(new winston.transports.File({ filename: path.join(__dirname, '../../logs/server.log') }));
}
