import axios from "axios";
import * as cheerio from "cheerio";
import * as fs from "fs";

function capitalizeFirstLetter(text: string) {
    return text.charAt(0).toUpperCase() + text.slice(1);
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

class TheMeWPCrawler {
    private readonly URL = "https://themewp.vn/blogs/";
    private readonly headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36",
    };


    constructor() {
    }

    public async getSoup(url: string) {
        const response = await axios.get(url, {headers: this.headers});
        return cheerio.load(response.data);
    }

    public async getAllPosts(url: string) {
        const posts: Blog[] = [];
        const soup = await this.getSoup(url)
        soup("div.col.post-item").each((_index: any, element: any) => {
            let title = soup(element).find("h5.post-title.is-large").text().replaceAll('\n', '').trim();
            let url = soup(element).find("h5.post-title.is-large a").attr("href") || "";
            const urlObject = new URL(url);
            const pathName = urlObject.pathname;
            const parts = pathName.split('/');
            const slug = parts[parts.length - 2];
            let thumbnail = soup(element).find("img.wp-post-image").attr("data-src") || "";
            thumbnail = `https:${thumbnail}`;
            posts.push({
                thumbnail,
                title,
                url,
                slug
            });
        });
        console.log(`Crawled ${posts.length} posts.`);
        return posts;
    }

    public async getInformation(post: Blog) {
        const soup = await this.getSoup(post.url);
        let content = soup("div.entry-content");
        content.find('.xem-them').remove();
        content.find('.kk-star-ratings').remove();
        content.find('img').each((_index, element) => {
            const imgElement = soup(element);
            imgElement.attr('src', imgElement.attr('data-src'));
        });
        post.content = content.html() || "";

        const categoriesHtml = soup('div.danh-muc >a')
        categoriesHtml.each((_index: any, element: any) => {
            const name = soup(element).text().trim();
            const slug = soup(element).attr("href") || "";
            post.categories = post.categories || [];
            post.categories.push({
                name: capitalizeFirstLetter(name),
                slug
            });
        });
        const tagsHtml = soup('div.the-tim-kiem >a')
        tagsHtml.each((_index: any, element: any) => {
            const name = soup(element).text().trim();
            const slug = soup(element).attr("href") || "";
            post.tags = post.tags || [];
            post.tags.push({
                name,
                slug
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

    // const crawler = new TheMeWPCrawler();
    // const HOST = "https://themewp.vn/blogs/page/";
    // const urls = Array.from({length: 7}, (_, i) => `${HOST}${i + 1}`);
    // const promises = urls.map(url => crawler.getAllInformation(url));
    // const results = await Promise.all(promises);
    // fs.writeFileSync('posts.json', JSON.stringify(results.flat(), null, 2), 'utf-8');
    const postContent = fs.readFileSync('posts.json', 'utf-8');
    const posts = JSON.parse(postContent) as Blog[];
    console.log(posts.length);
})();