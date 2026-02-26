"use client";

import { Suspense } from "react";
import FormPage from "@/components/FormPage";

const FIELDS = [
    { name: "name", label: "Full Name", type: "text" as const, required: true, placeholder: "Jane Smith" },
    { name: "email", label: "Email", type: "email" as const, required: true, placeholder: "jane@yourbrand.com" },
    { name: "company", label: "Company / Brand", type: "text" as const, placeholder: "Your Brand Co." },
    { name: "phone", label: "Phone", type: "tel" as const, placeholder: "+1 (555) 000-0000" },
    { name: "products", label: "Products of Interest", type: "textarea" as const, required: true, placeholder: "e.g. Cylinder 30ml Clear, Elegant 60ml Frosted with gold sprayer..." },
    { name: "quantities", label: "Estimated Quantities", type: "text" as const, placeholder: "e.g. 500-1,000 pieces" },
    { name: "message", label: "Additional Notes", type: "textarea" as const, placeholder: "Timeline, special requirements, anything else we should know..." },
];

export default function RequestSamplePage() {
    return (
        <Suspense>
            <FormPage
                formType="sample"
                title="Request a Sample"
                subtitle="Experience the quality of our glass firsthand. Tell us what you're looking for and we'll put together a curated sample package."
                fields={FIELDS}
            />
        </Suspense>
    );
}
