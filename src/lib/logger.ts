/**
 * Structured Logger for RGB++ Strong Binding
 * Provides consistent logging across the application
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

export class Logger {
  private context: string;
  
  constructor(context: string) {
    this.context = context;
  }

  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] [${this.context}] ${message}`;
  }

  private log(level: LogLevel, message: string, data?: any) {
    const formattedMessage = this.formatMessage(level, message, data);
    
    switch (level) {
      case LogLevel.DEBUG:
        console.log(formattedMessage, data || '');
        break;
      case LogLevel.INFO:
        console.info(`ℹ️ ${formattedMessage}`, data || '');
        break;
      case LogLevel.WARN:
        console.warn(`⚠️ ${formattedMessage}`, data || '');
        break;
      case LogLevel.ERROR:
        console.error(`❌ ${formattedMessage}`, data || '');
        break;
    }
    
    // Store critical logs for debugging
    if (level === LogLevel.ERROR || level === LogLevel.WARN) {
      this.storeLog(level, message, data);
    }
  }

  private storeLog(level: LogLevel, message: string, data?: any) {
    try {
      const logs = JSON.parse(localStorage.getItem('rgbpp_logs') || '[]');
      logs.push({
        timestamp: new Date().toISOString(),
        level,
        context: this.context,
        message,
        data: data ? JSON.stringify(data) : null
      });
      // Keep only last 100 logs
      if (logs.length > 100) {
        logs.shift();
      }
      localStorage.setItem('rgbpp_logs', JSON.stringify(logs));
    } catch (e) {
      // Ignore storage errors
    }
  }

  debug(message: string, data?: any) {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: any) {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: any) {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, data?: any) {
    this.log(LogLevel.ERROR, message, data);
  }

  // Special logging for PSBT operations
  logPsbt(operation: string, psbtHex: string, details?: any) {
    const psbtInfo = {
      operation,
      length: psbtHex.length,
      prefix: psbtHex.substring(0, 16),
      hasMagicBytes: psbtHex.startsWith('70736274ff'),
      ...details
    };
    this.info(`PSBT ${operation}`, psbtInfo);
  }

  // Special logging for transaction IDs
  logTransaction(type: 'BTC' | 'CKB', txId: string, details?: any) {
    const txInfo = {
      type,
      txId,
      shortId: txId ? `${txId.slice(0, 8)}...${txId.slice(-8)}` : 'N/A',
      ...details
    };
    this.info(`${type} Transaction`, txInfo);
  }

  // Special logging for RGB++ operations
  logRgbpp(operation: string, details: any) {
    this.info(`RGB++ ${operation}`, details);
  }

  // Log input validation for UTXOs
  logUtxoValidation(utxos: any[]) {
    const stats = {
      totalInputs: utxos.length,
      witnessInputs: 0,
      nonWitnessInputs: 0,
      invalidInputs: 0
    };
    
    utxos.forEach(utxo => {
      if (utxo.witnessUtxo) {
        stats.witnessInputs++;
      } else if (utxo.nonWitnessUtxo) {
        stats.nonWitnessInputs++;
      } else {
        stats.invalidInputs++;
      }
    });
    
    this.info('UTXO Validation', stats);
    
    if (stats.invalidInputs > 0) {
      this.warn('Invalid UTXOs detected', { count: stats.invalidInputs });
    }
  }

  // Get stored logs for debugging
  static getLogs(): any[] {
    try {
      return JSON.parse(localStorage.getItem('rgbpp_logs') || '[]');
    } catch (e) {
      return [];
    }
  }

  // Clear stored logs
  static clearLogs() {
    localStorage.removeItem('rgbpp_logs');
  }
}

// Export singleton instances for different modules
export const psbtLogger = new Logger('PSBTGuard');
export const rgbppLogger = new Logger('RGB++');
export const apiLogger = new Logger('API');
export const walletLogger = new Logger('Wallet');
export const uiLogger = new Logger('UI');

// Export default logger factory
export default function createLogger(context: string): Logger {
  return new Logger(context);
}