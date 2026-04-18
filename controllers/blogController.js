const { Octokit } = require("@octokit/rest");
const { cloudinary } = require("../config/cloudinary");

// POST /api/upload-blog-image — upload image to Cloudinary (protected)
const uploadBlogImage = async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) return res.status(400).json({ error: "No image provided" });

    const sizeInMB = (imageBase64.length * 0.75) / 1024 / 1024;
    if (sizeInMB > 8) {
      return res.status(400).json({
        error: `Image too large (${sizeInMB.toFixed(1)}MB). Please use an image under 8MB.`,
      });
    }

    const result = await cloudinary.uploader.upload(imageBase64, {
      folder: "skyup/blogs",
      resource_type: "image",
    });

    console.log(`✅ Blog image uploaded to Cloudinary: ${result.secure_url}`);
    res.json({ url: result.secure_url });
  } catch (err) {
    console.error("❌ Blog image upload error:", err);
    res.status(500).json({ error: err.message });
  }
};

// POST /api/publish-blog — publish blog to GitHub + update sitemap (protected)
const publishBlog = async (req, res) => {
  try {
    const { blogData } = req.body;

    if (!blogData || !blogData.slug) {
      return res.status(400).json({ error: "Invalid blog data — slug is required." });
    }

    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || "main";
    const blogsFilePath = process.env.BLOGS_FILE_PATH || "src/data/blogs.js";
    const sitemapFilePath = process.env.SITEMAP_FILE_PATH || "public/sitemap.xml";

    // Step 1: Fetch current blogs.js
    let currentContent = "";
    let blogsFileSha = null;
    try {
      const { data } = await octokit.repos.getContent({ owner, repo, path: blogsFilePath, ref: branch });
      currentContent = Buffer.from(data.content, "base64").toString("utf8");
      blogsFileSha = data.sha;
    } catch (e) {
      if (e.status !== 404) throw e;
      currentContent = "export const BLOGS = [];\n";
    }

    // Step 2: Parse existing BLOGS array
    const match = currentContent.match(/export\s+const\s+BLOGS\s*=\s*(\[[\s\S]*\]);/);
    let blogs = [];
    if (match) {
      try {
        blogs = new Function(`return ${match[1]}`)();
      } catch {
        return res.status(500).json({ error: "Could not parse existing blogs.js — check file syntax." });
      }
    }

    // Step 3: Insert or update blog
    const existingIndex = blogs.findIndex((b) => b.slug === blogData.slug);
    const newBlog = {
      ...blogData,
      id: existingIndex >= 0 ? blogs[existingIndex].id : Date.now(),
    };
    const isUpdate = existingIndex >= 0;
    if (isUpdate) {
      blogs[existingIndex] = newBlog;
      console.log(`✅ Updated existing blog: ${blogData.slug}`);
    } else {
      blogs.unshift(newBlog);
      console.log(`✅ Added new blog: ${blogData.slug}`);
    }

    // Step 4: Serialize blogs.js
    const newBlogsContent = `export const BLOGS = ${JSON.stringify(blogs, null, 2)};\n`;

    // Step 5: Build updated sitemap.xml
    const today = new Date().toISOString().split("T")[0];

    let existingSitemapXml = null;
    let sitemapFileSha = null;
    try {
      const { data } = await octokit.repos.getContent({ owner, repo, path: sitemapFilePath, ref: branch });
      existingSitemapXml = Buffer.from(data.content, "base64").toString("utf8");
      sitemapFileSha = data.sha;
    } catch (e) {
      if (e.status !== 404) throw e;
    }

    const blogUrlEntries = blogs
      .map(
        (b) => `  <url>
    <loc>https://www.skyupdigitalsolutions.com/blogs/${b.slug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`
      )
      .join("\n");

    let newSitemapXml;
    if (existingSitemapXml) {
      const withoutBlogEntries = existingSitemapXml.replace(
        /\s*<url>\s*<loc>https:\/\/www\.skyupdigitalsolutions\.com\/blogs\/[^<]+<\/loc>[\s\S]*?<\/url>/g,
        ""
      );
      const withUpdatedBlogsListMod = withoutBlogEntries.replace(
        /(<loc>https:\/\/www\.skyupdigitalsolutions\.com\/blogs<\/loc>\s*<lastmod>)[^<]+(<\/lastmod>)/,
        `$1${today}$2`
      );
      newSitemapXml = withUpdatedBlogsListMod.replace("</urlset>", `${blogUrlEntries}\n</urlset>`);
    } else {
      newSitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.skyupdigitalsolutions.com</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>
  <url><loc>https://www.skyupdigitalsolutions.com/aboutus</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://www.skyupdigitalsolutions.com/service</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>
  <url><loc>https://www.skyupdigitalsolutions.com/blogs</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>
  <url><loc>https://www.skyupdigitalsolutions.com/contactus</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.9</priority></url>
  <url><loc>https://www.skyupdigitalsolutions.com/careers</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.9</priority></url>
  <url><loc>https://www.skyupdigitalsolutions.com/privacypolicy</loc><lastmod>${today}</lastmod><changefreq>yearly</changefreq><priority>0.3</priority></url>
  <url><loc>https://www.skyupdigitalsolutions.com/termscondition</loc><lastmod>${today}</lastmod><changefreq>yearly</changefreq><priority>0.3</priority></url>
  <url><loc>https://www.skyupdigitalsolutions.com/services/seo-company-in-bangalore</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>
  <url><loc>https://www.skyupdigitalsolutions.com/services/email-marketing-company-in-bangalore</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>
  <url><loc>https://www.skyupdigitalsolutions.com/services/creative-graphic-design</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>
  <url><loc>https://www.skyupdigitalsolutions.com/services/branding-agency-in-bangalore</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>
  <url><loc>https://www.skyupdigitalsolutions.com/services/ui-ux-design-company-in-bangalore</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>
  <url><loc>https://www.skyupdigitalsolutions.com/services/social-media-marketing</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>
  <url><loc>https://www.skyupdigitalsolutions.com/services/website-development-company-in-bangalore</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>
  <url><loc>https://www.skyupdigitalsolutions.com/services/ai-company-in-bangalore</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>
  <url><loc>https://www.skyupdigitalsolutions.com/services/ppc-company-in-bangalore</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>
${blogUrlEntries}
</urlset>`;
    }

    // Step 6: Commit both files to GitHub
    const blogsCommitPayload = {
      owner, repo, path: blogsFilePath, branch,
      message: `blog: ${isUpdate ? "update" : "add"} "${blogData.headline || blogData.slug}"`,
      content: Buffer.from(newBlogsContent).toString("base64"),
      committer: { name: "Blog Builder Bot", email: "bot@skyupdigital.com" },
    };
    if (blogsFileSha) blogsCommitPayload.sha = blogsFileSha;
    await octokit.repos.createOrUpdateFileContents(blogsCommitPayload);

    const sitemapCommitPayload = {
      owner, repo, path: sitemapFilePath, branch,
      message: `sitemap: add /blogs/${blogData.slug}`,
      content: Buffer.from(newSitemapXml).toString("base64"),
      committer: { name: "Blog Builder Bot", email: "bot@skyupdigital.com" },
    };
    if (sitemapFileSha) sitemapCommitPayload.sha = sitemapFileSha;
    await octokit.repos.createOrUpdateFileContents(sitemapCommitPayload);

    console.log(`✅ Blog "${blogData.slug}" and sitemap pushed to GitHub by ${req.user.email}`);
    res.json({
      message: `✅ Blog "${blogData.headline}" published and sitemap updated!`,
      slug: blogData.slug,
    });
  } catch (err) {
    console.error("❌ Publish error:", err);
    res.status(500).json({ error: err.message || "Failed to publish blog" });
  }
};

module.exports = { uploadBlogImage, publishBlog };