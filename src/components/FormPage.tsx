"use client";

import { useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Send, CheckCircle2, Loader2 } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

type FormType = "sample" | "quote" | "contact" | "newsletter";

interface FormField {
    name: string;
    label: string;
    type: "text" | "email" | "tel" | "textarea";
    required?: boolean;
    placeholder?: string;
}

interface FormPageProps {
    formType: FormType;
    title: string;
    subtitle: string;
    fields: FormField[];
}

export default function FormPage({ formType, title, subtitle, fields }: FormPageProps) {
    const searchParams = useSearchParams();
    const submitForm = useMutation(api.forms.submit);
    const [values, setValues] = useState<Record<string, string>>(() => {
        const prefilled: Record<string, string> = {};
        fields.forEach((f) => {
            const param = searchParams.get(f.name);
            if (param) prefilled[f.name] = param;
        });
        return prefilled;
    });
    const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState("");

    // React to URL searchParam changes (e.g. when Grace navigates to this page with pre-filled params)
    useEffect(() => {
        const prefilled: Record<string, string> = {};
        fields.forEach((f) => {
            const param = searchParams.get(f.name);
            if (param) prefilled[f.name] = param;
        });
        if (Object.keys(prefilled).length > 0) {
            setValues((v) => ({ ...v, ...prefilled }));
        }
    }, [searchParams, fields]);

    // React to Grace in-place pre-fill when already on this form page
    useEffect(() => {
        const handler = (e: Event) => {
            const { formType: targetType, fields: prefilled } = (e as CustomEvent<{ formType: string; fields: Record<string, string> }>).detail;
            if (targetType === formType) {
                setValues((v) => ({ ...v, ...prefilled }));
            }
        };
        window.addEventListener("grace:prefillForm", handler);
        return () => window.removeEventListener("grace:prefillForm", handler);
    }, [formType]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setStatus("submitting");
        setErrorMsg("");

        try {
            await submitForm({
                formType,
                name: values.name || undefined,
                email: values.email || "",
                company: values.company || undefined,
                phone: values.phone || undefined,
                message: values.message || undefined,
                products: values.products || undefined,
                quantities: values.quantities || undefined,
                source: "website",
            });
            setStatus("success");
        } catch (err) {
            console.error("[Form] Submit error:", err);
            setErrorMsg(err instanceof Error ? err.message : "Something went wrong. Please try again.");
            setStatus("error");
        }
    };

    if (status === "success") {
        return (
            <div className="min-h-screen bg-bone flex items-center justify-center px-6">
                <div className="max-w-md text-center">
                    <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                    </div>
                    <h1 className="font-serif text-3xl text-obsidian mb-3">Thank You</h1>
                    <p className="text-slate text-sm leading-relaxed mb-8">
                        {formType === "sample"
                            ? "We've received your sample request. Our team will review it and get back to you within 1-2 business days."
                            : formType === "quote"
                            ? "Your quote request has been submitted. Our sales team will prepare a custom quote and reach out shortly."
                            : "Your message has been received. We'll get back to you as soon as possible."}
                    </p>
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-obsidian text-bone text-sm font-semibold tracking-wide uppercase hover:bg-muted-gold transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Home
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-bone">
            <div className="max-w-[640px] mx-auto px-6 pt-32 pb-20">
                <Link
                    href="/"
                    className="inline-flex items-center gap-1.5 text-sm text-slate hover:text-obsidian transition-colors mb-8"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                </Link>

                <h1 className="font-serif text-4xl lg:text-5xl text-obsidian mb-3">{title}</h1>
                <p className="text-slate text-sm leading-relaxed mb-10 max-w-md">{subtitle}</p>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {fields.map((field) => (
                        <div key={field.name}>
                            <label
                                htmlFor={field.name}
                                className="block text-xs font-bold uppercase tracking-wider text-obsidian/70 mb-1.5"
                            >
                                {field.label}
                                {field.required && <span className="text-red-500 ml-0.5">*</span>}
                            </label>
                            {field.type === "textarea" ? (
                                <textarea
                                    id={field.name}
                                    name={field.name}
                                    required={field.required}
                                    placeholder={field.placeholder}
                                    value={values[field.name] ?? ""}
                                    onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
                                    rows={4}
                                    className="w-full bg-white border border-champagne/60 rounded-lg px-4 py-3 text-sm text-obsidian placeholder-slate/40 focus:outline-none focus:border-muted-gold focus:ring-2 focus:ring-muted-gold/15 transition-all resize-none"
                                />
                            ) : (
                                <input
                                    id={field.name}
                                    name={field.name}
                                    type={field.type}
                                    required={field.required}
                                    placeholder={field.placeholder}
                                    value={values[field.name] ?? ""}
                                    onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
                                    className="w-full bg-white border border-champagne/60 rounded-lg px-4 py-3 text-sm text-obsidian placeholder-slate/40 focus:outline-none focus:border-muted-gold focus:ring-2 focus:ring-muted-gold/15 transition-all"
                                />
                            )}
                        </div>
                    ))}

                    {status === "error" && errorMsg && (
                        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                            {errorMsg}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={status === "submitting"}
                        className="w-full flex items-center justify-center gap-2 py-4 bg-obsidian text-bone text-sm font-semibold tracking-wide uppercase hover:bg-muted-gold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {status === "submitting" ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Submitting...
                            </>
                        ) : (
                            <>
                                <Send className="w-4 h-4" />
                                Submit
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
