//@::sequenceDiagram

//@Provider
class DocumentProvider {
  //@Provider1:Upload document
  async uploadDocument(file) {
    //@Provider->1>Provider:Validate input
    const validation = await this.validate(file);
    
    //@Provider->1.1>Provider:Build multipart body
    const formData = new FormData();
    formData.append('file', file);
    
    //@Provider->1.2>Provider:Create HTTP Request
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    
    //@Provider->2>Storage:Save to S3
    const s3Url = await this.storage.save(file);
    
    //@Provider->3>Database:Record metadata
    await this.db.insert({
      filename: file.name,
      url: s3Url
    });
    
    //@Provider->4>Notification:Send confirmation
    await this.notifyUser(file.ownerId);
    
    return { success: true, url: s3Url };
  }
}

//@Storage
class S3Storage {
  //@Storage1:Save file
  async save(file) {
    //@Storage->1>S3:Upload with ACL
    const key = `uploads/${Date.now()}_${file.name}`;
    await this.s3.putObject({
      Bucket: 'my-bucket',
      Key: key,
      Body: file,
      ACL: 'private'
    });
    
    return `https://my-bucket.s3.amazonaws.com/${key}`;
  }
}

//@Database
class DocumentDatabase {
  //@Database1:Insert record
  async insert(data) {
    //@Database->1>Database:Validate schema
    const validated = this.schema.validate(data);
    
    //@Database->2>Database:Execute INSERT
    const result = await this.query(
      'INSERT INTO documents SET ?',
      validated
    );
    
    return result.insertId;
  }
}

//@Notification
class NotificationService {
  //@Notification1:Notify user
  async notifyUser(userId) {
    //@Notification->1>User:Send email
    await this.email.send({
      to: userId,
      subject: 'Document uploaded',
      body: 'Your document has been uploaded successfully'
    });
  }
}

//@User
class User {
  //@User1:Receive notification
  async receiveNotification(message) {
    //@User->1>User:Display notification
    this.showToast(message);
  }
}