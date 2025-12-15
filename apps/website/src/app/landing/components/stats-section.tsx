"use client";

import { Clock, Github, ShieldCheck, Zap } from "lucide-react";
import { DotPattern } from "@/components/dot-pattern";
import { Card, CardContent } from "@/components/ui/card";

const stats = [
  {
    icon: Clock,
    value: "<2 min",
    label: "Deploy Time",
    description: "One command, full infrastructure",
  },
  {
    icon: Zap,
    value: "$0.10",
    label: "Per 1K Emails",
    description: "AWS SES pricing, billed to you",
  },
  {
    icon: ShieldCheck,
    value: "Zero",
    label: "Stored Credentials",
    description: "Your keys never leave your machine",
  },
  {
    icon: Github,
    value: "100%",
    label: "Open Source",
    description: "CLI, SDK, and Console",
    href: "https://github.com/wraps-team/wraps",
  },
];

export function StatsSection() {
  return (
    <section className="relative py-12 sm:py-16">
      {/* Background with transparency */}
      <div className="absolute inset-0 bg-linear-to-r from-primary/8 via-transparent to-secondary/20" />
      <DotPattern className="opacity-75" fadeStyle="circle" size="md" />

      <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-6 md:gap-8 lg:grid-cols-4">
          {stats.map((stat) => {
            const cardContent = (
              <Card
                className="border-border/50 bg-background/60 py-0 text-center backdrop-blur-sm"
              >
                <CardContent className="p-6">
                  <div className="mb-4 flex justify-center">
                    <div className="rounded-xl bg-primary/10 p-3">
                      <stat.icon className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-2xl text-foreground sm:text-3xl">
                      {stat.value}
                    </h3>
                    <p className="font-semibold text-foreground">{stat.label}</p>
                    <p className="text-muted-foreground text-sm">
                      {stat.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );

            if (stat.href) {
              return (
                <a
                  className="transition-transform hover:scale-105"
                  href={stat.href}
                  key={stat.label}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {cardContent}
                </a>
              );
            }

            return <div key={stat.label}>{cardContent}</div>;
          })}
        </div>
      </div>
    </section>
  );
}
