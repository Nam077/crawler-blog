import axios from "axios";
import * as cheerio from "cheerio";
import * as fs from "fs";

function capitalizeFirstLetter(text: string) {
    return text.charAt(0).toUpperCase() + text.slice(1);
}

const chunk = <T>(array: T[], size: number) => {
    const result = [];
    for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
    }
    return result;
};


function getSlugFromUrl(url: string) {
    const urlObject = new URL(url);
    const pathName = urlObject.pathname;
    const parts = pathName.split('/');
    return parts[parts.length - 2];
}

interface Tag {
    name: string;
    slug: string;
}

interface Category {
    name: string;
    slug: string;
}

interface Blog {
    thumbnail: string;
    description?: string;
    title: string;
    url: string;
    slug: string;
    categories?: Category[];
    tags?: Tag[];
    content?: string;

}

class DJICrawler {
    private readonly headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36",
    };


    constructor() {
    }

    public async getSoup(url: string) {
        let retryCount = 3;
        while (retryCount > 0) {
            try {
                const response = await axios.get(url, {headers: this.headers});
                return cheerio.load(response.data);
            } catch (e) {
                retryCount--;
                console.log(`Retry ${retryCount} time(s) url: ${url}`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        return cheerio.load('');
    }

    public async getAllPosts(url: string) {
        const posts: Blog[] = [];
        const soup = await this.getSoup(url)
        soup("div.col.post-item").each((_index: any, element: any) => {
            fs.writeFileSync("test.html", soup(element).html() || "");
            let title = soup(element).find("h5.post-title.is-large").text().replaceAll('\n', '').trim();
            // <div class="col-inner">
            //     <a href="https://dji-vietnam.vn/dji-mini-4-pro-va-dji-mini-3-pro/" class="plain">
            let url = soup(element).find("a.plain").attr("href") || "";
            let thumbnail = soup(element).find("img.image-cover").attr("data-src") || "";
            thumbnail = `https:${thumbnail}`;
            posts.push({
                thumbnail,
                title,
                url,
                slug: getSlugFromUrl(url),
            });
        });
        console.log(`Crawled ${posts.length} posts.`);
        return posts;
    }

    public async getAllPage(url: string) {
        const soup = await this.getSoup(url)
        return soup("a.page-number").not('a.next').last().text();
    }

    public async getInformation(post: Blog) {
        const soup = await this.getSoup(post.url);
        let content = soup("div.article-inner");
        post.content = (content.html() || "").replaceAll('\n', '').replaceAll('\t', '').trim();

        const categoriesHtml = soup('h6.entry-category.is-xsmall > a')
        categoriesHtml.each((_index: any, element: any) => {
            const name = soup(element).text().trim();
            const url = soup(element).attr("href") || "";
            post.categories = post.categories || [];
            post.categories.push({
                name: capitalizeFirstLetter(name),
                slug: getSlugFromUrl(url)
            });
        });
        console.log(`Crawled ${post.title}.`);
        return post;
    }

    public async getAllInformation(url: string) {
        const posts = await this.getAllPosts(url);
        return Promise.all(posts.map(post => this.getInformation(post)));
    }
}

(async () => {
    const folderData = 'data'
    if (!fs.existsSync(folderData)) {
        fs.mkdirSync(folderData);
    }
    const type = ['flycam', 'fpv', 'meo-va-huong-dan']
    const crawler = new DJICrawler();
    for (const item of type) {
        const HOST = `https://dji-vietnam.vn/${item}`;
        const allPages = await crawler.getAllPage(HOST);
        const urls = Array.from({length: parseInt(allPages)}, (_, i) => `${HOST}/page/${i + 1}`);
        const results = []
        for (const url of urls) {
            results.push(await crawler.getAllInformation(url));
        }
        fs.writeFileSync(`${folderData}/${item}.json`, JSON.stringify(results.flat(), null, 2), 'utf-8');
    }

})();