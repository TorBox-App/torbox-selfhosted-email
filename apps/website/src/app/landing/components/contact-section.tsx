"use client";

import { useForm } from "@tanstack/react-form";
import { BookOpen, Github, Mail, MessageCircle } from "lucide-react";
import Link from "next/link";
import { memo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const contactFormSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters."),
  lastName: z.string().min(2, "Last name must be at least 2 characters."),
  email: z.string().email("Please enter a valid email address."),
  subject: z.string().min(5, "Subject must be at least 5 characters."),
  message: z.string().min(10, "Message must be at least 10 characters."),
});

const ContactSection = memo(function ContactSection() {
  const [isSubmitted, setIsSubmitted] = useState(false);

  const form = useForm({
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      subject: "",
      message: "",
    },
    validators: {
      onSubmit: contactFormSchema,
    },
    onSubmit: async () => {
      // Here you would typically send the form data to your backend
      toast.success("Message sent successfully!");
      setIsSubmitted(true);
      form.reset();
      // Reset the submitted state after a delay
      setTimeout(() => setIsSubmitted(false), 3000);
    },
  });

  return (
    <section className="py-24 sm:py-32" id="contact">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <Badge className="mb-4" variant="outline">
            Get In Touch
          </Badge>
          <h2 className="mb-4 font-bold text-3xl tracking-tight sm:text-4xl">
            Need help or have questions?
          </h2>
          <p className="text-lg text-muted-foreground">
            Our team is here to help you get the most out of Wraps. Choose the
            best way to reach out to us.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Contact Options */}
          <div className="order-2 space-y-6 lg:order-1">
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle
                    aria-hidden="true"
                    className="h-5 w-5 text-primary"
                  />
                  Discord Community
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-muted-foreground">
                  Join our active community for quick help and discussions with
                  other developers.
                </p>
                <Button
                  asChild
                  className="cursor-pointer"
                  size="sm"
                  variant="outline"
                >
                  <a
                    href="https://discord.com/invite/XEQhPc9a6p"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Join Discord
                  </a>
                </Button>
              </CardContent>
            </Card>

            <Card className="transition-shadow hover:shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Github aria-hidden="true" className="h-5 w-5 text-primary" />
                  GitHub Issues
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-muted-foreground">
                  Report bugs, request features, or contribute to our open
                  source repository.
                </p>
                <Button
                  asChild
                  className="cursor-pointer"
                  size="sm"
                  variant="outline"
                >
                  <a
                    href="https://github.com/wraps-team/wraps/issues"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    View on GitHub
                  </a>
                </Button>
              </CardContent>
            </Card>

            <Card className="transition-shadow hover:shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen
                    aria-hidden="true"
                    className="h-5 w-5 text-primary"
                  />
                  Documentation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-muted-foreground">
                  Browse our comprehensive guides, tutorials, and component
                  documentation.
                </p>
                <Button
                  asChild
                  className="cursor-pointer"
                  size="sm"
                  variant="outline"
                >
                  <Link href="/docs">View Docs</Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Contact Form */}
          <div className="order-1 lg:order-2 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail aria-hidden="true" className="h-5 w-5" />
                  Send us a message
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  className="space-y-6"
                  onSubmit={(e) => {
                    e.preventDefault();
                    form.handleSubmit();
                  }}
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <form.Field name="firstName">
                      {(field) => (
                        <div className="grid gap-2">
                          <Label htmlFor={field.name}>First name</Label>
                          <Input
                            id={field.name}
                            name={field.name}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            placeholder="John"
                            value={field.state.value}
                          />
                          {field.state.meta.errors.map((error) => (
                            <p
                              className="text-destructive text-sm"
                              key={
                                typeof error === "string"
                                  ? error
                                  : error?.message
                              }
                            >
                              {typeof error === "string"
                                ? error
                                : error?.message}
                            </p>
                          ))}
                        </div>
                      )}
                    </form.Field>
                    <form.Field name="lastName">
                      {(field) => (
                        <div className="grid gap-2">
                          <Label htmlFor={field.name}>Last name</Label>
                          <Input
                            id={field.name}
                            name={field.name}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            placeholder="Doe"
                            value={field.state.value}
                          />
                          {field.state.meta.errors.map((error) => (
                            <p
                              className="text-destructive text-sm"
                              key={
                                typeof error === "string"
                                  ? error
                                  : error?.message
                              }
                            >
                              {typeof error === "string"
                                ? error
                                : error?.message}
                            </p>
                          ))}
                        </div>
                      )}
                    </form.Field>
                  </div>
                  <form.Field name="email">
                    {(field) => (
                      <div className="grid gap-2">
                        <Label htmlFor={field.name}>Email</Label>
                        <Input
                          id={field.name}
                          name={field.name}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="john@example.com"
                          type="email"
                          value={field.state.value}
                        />
                        {field.state.meta.errors.map((error) => (
                          <p
                            className="text-destructive text-sm"
                            key={
                              typeof error === "string" ? error : error?.message
                            }
                          >
                            {typeof error === "string" ? error : error?.message}
                          </p>
                        ))}
                      </div>
                    )}
                  </form.Field>
                  <form.Field name="subject">
                    {(field) => (
                      <div className="grid gap-2">
                        <Label htmlFor={field.name}>Subject</Label>
                        <Input
                          id={field.name}
                          name={field.name}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="Component request, bug report, general inquiry..."
                          value={field.state.value}
                        />
                        {field.state.meta.errors.map((error) => (
                          <p
                            className="text-destructive text-sm"
                            key={
                              typeof error === "string" ? error : error?.message
                            }
                          >
                            {typeof error === "string" ? error : error?.message}
                          </p>
                        ))}
                      </div>
                    )}
                  </form.Field>
                  <form.Field name="message">
                    {(field) => (
                      <div className="grid gap-2">
                        <Label htmlFor={field.name}>Message</Label>
                        <Textarea
                          className="min-h-50"
                          id={field.name}
                          name={field.name}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="Tell us how we can help you with Wraps..."
                          rows={10}
                          value={field.state.value}
                        />
                        {field.state.meta.errors.map((error) => (
                          <p
                            className="text-destructive text-sm"
                            key={
                              typeof error === "string" ? error : error?.message
                            }
                          >
                            {typeof error === "string" ? error : error?.message}
                          </p>
                        ))}
                      </div>
                    )}
                  </form.Field>
                  <form.Subscribe
                    selector={(state) => ({
                      canSubmit: state.canSubmit,
                      isSubmitting: state.isSubmitting,
                    })}
                  >
                    {({ canSubmit, isSubmitting }) => (
                      <Button
                        className="w-full cursor-pointer"
                        disabled={!canSubmit || isSubmitting || isSubmitted}
                        type="submit"
                      >
                        {isSubmitting
                          ? "Sending..."
                          : isSubmitted
                            ? "Message Sent!"
                            : "Send Message"}
                      </Button>
                    )}
                  </form.Subscribe>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
});

export { ContactSection };
