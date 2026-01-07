"use client";

import { ArrowRight, Calendar, Clock, Shield } from "lucide-react";
import { LandingFooter } from "@/app/landing/components/footer";
import { LandingNavbar } from "@/app/landing/components/navbar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type BlogPost = {
  slug: string;
  title: string;
  description: string;
  category: string;
  date: string;
  readTime: string;
  featured?: boolean;
  icon?: React.ReactNode;
  image?: string;
};

const posts: BlogPost[] = [
  {
    slug: "your-dmarc-policy-is-useless",
    title: "Your DMARC policy is useless",
    description:
      "82% of domains have no DMARC. Of those that do, most set p=none—which does exactly nothing. An interactive deep-dive into email authentication failures and the real cost of weak policies.",
    category: "Security",
    date: "January 2025",
    readTime: "12 min read",
    featured: true,
    icon: <Shield className="h-6 w-6" />,
    image: "/blog/DMARC_EXPLOITED.png",
  },
];

export default function Blog() {
  return (
    <div className="min-h-screen bg-background">
      <LandingNavbar />

      <main className="container mx-auto px-4 py-16 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">
          <Badge className="mb-4" variant="outline">
            Interactive Articles
          </Badge>
          <h1 className="mb-4 font-bold text-4xl tracking-tight sm:text-5xl">
            The Wraps Blog
          </h1>
          <p className="text-lg text-muted-foreground">
            Deep dives into email infrastructure, security, and developer
            experience. Interactive content that makes complex topics tangible.
          </p>
        </div>

        {/* Featured Post */}
        {posts.filter((p) => p.featured).length > 0 && (
          <section className="mt-16">
            <h2 className="mb-6 font-semibold text-muted-foreground text-sm uppercase tracking-wider">
              Featured
            </h2>
            {posts
              .filter((p) => p.featured)
              .map((post) => (
                <a
                  className="group block"
                  href={`/blog/${post.slug}`}
                  key={post.slug}
                >
                  <Card className="h-72 py-0 transition-all hover:border-primary/50 hover:shadow-lg md:flex-row md:gap-0">
                    <CardContent className="h-full px-0 md:shrink-0">
                      <img
                        alt={post.title}
                        className="aspect-video h-full w-auto rounded-l-xl object-cover"
                        src={post.image || ""}
                      />
                    </CardContent>
                    <div className="flex-1">
                      <CardHeader className="pt-4">
                        <div className="mb-1 flex items-center gap-2">
                          <Badge className="text-xs" variant="secondary">
                            {post.category}
                          </Badge>
                          <span className="flex items-center gap-1 text-muted-foreground text-xs">
                            <Calendar className="h-3 w-3" />
                            {post.date}
                          </span>
                          <span className="flex items-center gap-1 text-muted-foreground text-xs">
                            <Clock className="h-3 w-3" />
                            {post.readTime}
                          </span>
                        </div>
                        <CardTitle className="text-lg transition-colors group-hover:text-primary">
                          {post.title}
                        </CardTitle>
                        <CardDescription className="line-clamp-3 max-w-prose text-pretty text-md">
                          {post.description}
                        </CardDescription>
                      </CardHeader>
                      <div className="px-6 pt-2.5 pb-4">
                        <span className="inline-flex items-center gap-2 font-medium text-primary text-sm">
                          Read article{" "}
                          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
                        </span>
                      </div>
                    </div>
                  </Card>
                </a>
              ))}
          </section>
        )}

        {/* All Posts */}
        {posts.filter((p) => !p.featured).length > 0 && (
          <section className="mt-16">
            <h2 className="mb-6 font-semibold text-muted-foreground text-sm uppercase tracking-wider">
              All Articles
            </h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {posts
                .filter((p) => !p.featured)
                .map((post) => (
                  <a
                    className="group block"
                    href={`/blog/${post.slug}`}
                    key={post.slug}
                  >
                    <Card className="h-full transition-all hover:border-primary/50 hover:shadow-lg">
                      <CardHeader>
                        <div className="mb-2 flex items-center gap-3">
                          <Badge variant="secondary">{post.category}</Badge>
                          <span className="text-muted-foreground text-xs">
                            {post.readTime}
                          </span>
                        </div>
                        <CardTitle className="transition-colors group-hover:text-primary">
                          {post.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <CardDescription className="mb-4">
                          {post.description}
                        </CardDescription>
                        <span className="inline-flex items-center gap-2 font-medium text-primary text-sm">
                          Read more{" "}
                          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
                        </span>
                      </CardContent>
                    </Card>
                  </a>
                ))}
            </div>
          </section>
        )}

        {/* Coming Soon */}
        <section className="mt-24 text-center">
          <div className="mx-auto max-w-xl rounded-xl border border-dashed bg-muted/30 p-8">
            <h3 className="mb-2 font-semibold text-lg">More coming soon</h3>
            <p className="text-muted-foreground text-sm">
              We're working on more interactive deep-dives into email
              infrastructure, DNS, and developer tooling. Stay tuned.
            </p>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
