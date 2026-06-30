//@::sequenceDiagram

//@Client
class ApiClient {
  //@Client1:Fetch user data
  async fetchUserData(userId) {
    //@->Gateway:Send authenticated request
    const token = await this.authStore.getToken();
    const response = await fetch('/api/users/' + userId, {
      headers: { Authorization: 'Bearer ' + token }
    });
    if (response.status === 401) {
      //@->AuthMiddleware:Refresh expired token
      return this.handleUnauthorized();
    }
    return response.json();
  }

  async handleUnauthorized() {
    const newToken = await this.refreshAccessToken();
    if (newToken) {
      return this.retryLastRequest();
    }
    this.redirectToLogin();
  }
}

//@Gateway
class ApiGateway {
  //@Gateway1:Handle incoming request
  async handleRequest(req, res) {
    //@->AuthMiddleware:Validate JWT
    const clientIp = req.ip;
    const allowed = await this.rateLimiter.check(clientIp);
    if (!allowed) {
      //@->Error:Return 429 Too Many Requests
      return res.status(429).json({ error: 'Too many requests' });
    }
    //@->Server:Proxy to user service
    this.proxyToService(req, res);
  }
}

//@AuthMiddleware
class AuthMiddleware {
  //@AuthMiddleware1:Validate JWT token
  async validateToken(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      //@->Error:Return 401 Missing token
      return res.status(401).json({ error: 'Missing token' });
    }
    const token = header.split(' ')[1];
    try {
      const decoded = await this.jwtService.verify(token);
      req.userId = decoded.sub;
      req.roles = decoded.roles;
      next();
    } catch (err) {
      //@->Error:Return 401 Invalid token
      return res.status(401).json({ error: 'Invalid token' });
    }
  }

  async checkPermission(req, res, next) {
    const requiredRole = req.route?.requiredRole;
    if (requiredRole && !req.roles.includes(requiredRole)) {
      //@->Error:Return 403 Forbidden
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  }
}

//@Cache
class CacheService {
  //@Cache1:Read from cache
  async getCachedUser(userId) {
    const cached = await this.redis.get('user:' + userId);
    if (cached) {
      return JSON.parse(cached);
    }
    return null;
  }

  async setCachedUser(userId, userData) {
    //@->Cache:Write to Redis
    await this.redis.set('user:' + userId, JSON.stringify(userData), 'EX', 300);
  }
}

//@Server
class UserService {
  //@Server1:Get user by ID
  async getUserById(userId) {
    //@->Cache:Check cache for user
    const cached = await this.cacheService.getCachedUser(userId);
    if (cached) return cached;

    //@->Database:Query user with address JOIN
    const user = await this.userRepository.findById(userId);
    if (!user) {
      //@->Error:Throw NotFoundError
      throw new NotFoundError('User not found');
    }

    //@->Cache:Store user in cache
    await this.cacheService.setCachedUser(userId, user);

    //@->Notification:Send welcome email
    await this.notificationService.sendWelcomeEmail(user);

    //@->AuditLog:Record user fetch
    await this.auditLog.record('USER_FETCH', userId, {});

    return user;
  }

  async updateUser(userId, data) {
    const validated = await this.validator.validateUserUpdate(data);
    //@->Database:Update user in transaction
    const updated = await this.userRepository.update(userId, validated);
    //@->Cache:Invalidate user cache
    await this.cacheService.invalidate('user:' + userId);
    //@->AuditLog:Record user update
    await this.auditLog.record('USER_UPDATE', userId, data);
    return updated;
  }
}

//@Database
class UserRepository {
  //@Database1:Query user by ID
  async findById(userId) {
    const rows = await this.db.query(
      'SELECT u.*, a.street, a.city, a.country FROM users u LEFT JOIN addresses a ON u.default_address_id = a.id WHERE u.id = ? AND u.deleted_at IS NULL',
      [userId]
    );
    return rows[0] || null;
  }

  async update(userId, data) {
    const trx = await this.db.beginTransaction();
    try {
      await trx.query('UPDATE users SET ? WHERE id = ?', [data, userId]);
      await trx.commit();
    } catch (err) {
      await trx.rollback();
      throw err;
    }
  }
}

//@Notification
class NotificationService {
  //@Notification1:Send welcome email
  async sendWelcomeEmail(user) {
    const template = await this.emailTemplates.get('welcome');
    const body = template.render({ name: user.name });
    await this.emailProvider.send(user.email, 'Welcome!', body);
  }

  async sendPushNotification(userId, title, message) {
    const devices = await this.deviceRepository.getDevices(userId);
    //@->Client:Push notification to devices
    await this.pushProvider.send(devices, { title, message });
  }
}

//@AuditLog
class AuditLogService {
  //@AuditLog1:Record audit entry
  async record(action, userId, metadata) {
    await this.db.insert('audit_logs', {
      action,
      user_id: userId,
      metadata: JSON.stringify(metadata),
      ip_address: this.requestContext.ip,
      created_at: new Date(),
    });
  }
}

//@Error
class ErrorHandler {
  //@Error1:Handle API error
  handleError(error, req, res) {
    const status = error.status || 500;
    const message = status === 500 ? 'Internal server error' : error.message;
    if (status === 500) {
      this.logger.error('Unhandled error', { error, requestId: req.id });
    }
    //@->Client:Return error response
    res.status(status).json({ error: message, requestId: req.id });
  }
}
