import { getHomepageData } from "@/sanity/lib/queries";
import HomePage from "@/components/HomePage";

export default async function Page() {
    const homepageData = await getHomepageData();
    return <HomePage homepageData={homepageData} />;
}
