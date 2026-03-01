import { getHomepageData } from "@/sanity/lib/queries";
import HomePage from "@/components/HomePage";

// Revalidate every 60s so new Sanity images show up without full redeploy
export const revalidate = 60;

export default async function Page() {
    const homepageData = await getHomepageData();
    return <HomePage homepageData={homepageData} />;
}
