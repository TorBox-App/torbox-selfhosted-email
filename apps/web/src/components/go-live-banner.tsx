"use client";

import { CloudUpload, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useProductsStore } from "@/stores/products-store";

type GoLiveBannerProps = {
	orgSlug: string;
};

export function GoLiveBanner({ orgSlug }: GoLiveBannerProps) {
	const hasAwsAccounts = useProductsStore((s) => s.status?.hasAwsAccounts);
	const [dismissed, setDismissed] = useState(() => {
		return sessionStorage.getItem(`go-live-banner-dismissed-${orgSlug}`) === "true";
	});

	if (hasAwsAccounts || dismissed) {
		return null;
	}

	return (
		<div
			className="-mt-4 md:-mt-6 flex items-center justify-between gap-4 border-b bg-blue-50 border-blue-200 dark:bg-blue-950/50 dark:border-blue-800 px-4 py-2"
			role="status"
		>
			<div className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
				<CloudUpload className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
				<p className="text-sm">
					Your templates and workflows are ready. Connect AWS to start sending.
				</p>
			</div>
			<div className="flex items-center gap-2">
				<Button asChild size="sm" variant="outline">
					<Link href={`/${orgSlug}/onboarding`}>Connect AWS</Link>
				</Button>
				<Button
					aria-label="Dismiss banner"
					className="h-8 w-8 p-0"
					onClick={() => {
						sessionStorage.setItem(`go-live-banner-dismissed-${orgSlug}`, "true");
						setDismissed(true);
					}}
					size="sm"
					variant="ghost"
				>
					<X className="h-4 w-4" />
				</Button>
			</div>
		</div>
	);
}
