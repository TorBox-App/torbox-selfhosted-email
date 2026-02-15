ALTER TABLE "contact" ADD CONSTRAINT "contact_preferred_channel_check" CHECK ("preferred_channel" IN ('email', 'sms'));
ALTER TABLE "template" ADD CONSTRAINT "template_channel_check" CHECK ("channel" IN ('email', 'sms'));
