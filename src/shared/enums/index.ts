export enum EmailProcessors {
  NODE_MAILER = 'nodemailer', // Default
}

export enum MqttTopics {
  EMAIL = 'email',
  QUEUE_MAIL = 'queue.mail',
  QUEUE_CAMPAIGN = 'queue.campaign',
  MAIL_JOB_DONE = 'queue.jobdone',
}

export enum SmtpProviders {
  OFFICE365 = 'office365',
}
