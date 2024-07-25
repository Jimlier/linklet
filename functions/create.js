/**
 * @api {post} /create Create
 */

// 文件路径：functions/create.js

// 定义一个生成随机字符串的函数
function generateRandomString(length) {
    const characters = '1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'; // 可用字符集
    let result = ''; // 初始化结果字符串

    for (let i = 0; i < length; i++) { // 循环生成指定长度的字符串
        const randomIndex = Math.floor(Math.random() * characters.length); // 生成一个随机索引
        result += characters.charAt(randomIndex); // 从字符集中取出相应字符并添加到结果字符串中
    }

    return result; // 返回生成的随机字符串
}

// 异步处理请求的函数
export async function onRequest(context) {
    if (context.request.method === 'OPTIONS') { // 处理预检请求
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*', // 允许所有来源
                'Access-Control-Allow-Methods': 'POST, OPTIONS', // 允许的方法
                'Access-Control-Allow-Headers': 'Content-Type', // 允许的请求头
                'Access-Control-Max-Age': '86400', // 预检请求的缓存时间（24小时）
            },
        });
    }

    const { request, env } = context; // 从上下文中获取请求和环境变量
    const originurl = new URL(request.url); // 解析请求的URL
    const clientIP = request.headers.get("x-forwarded-for") || request.headers.get("clientIP"); // 获取客户端IP地址
    const userAgent = request.headers.get("user-agent"); // 获取客户端用户代理
    const origin = `${originurl.protocol}//${originurl.hostname}`; // 构造请求的来源URL

    // 配置日期格式选项
    const options = {
        timeZone: 'Asia/Shanghai', // 时区
        year: 'numeric', // 年
        month: 'long', // 月
        day: 'numeric', // 日
        hour12: false, // 24小时制
        hour: '2-digit', // 小时
        minute: '2-digit', // 分钟
        second: '2-digit' // 秒
    };
    const timedata = new Date(); // 当前时间
    const formattedDate = new Intl.DateTimeFormat('zh-CN', options).format(timedata); // 格式化时间
    const { url, slug } = await request.json(); // 解析请求体中的URL和slug参数
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*', // 允许所有来源
        'Access-Control-Allow-Headers': 'Content-Type', // 允许的请求头
        'Access-Control-Max-Age': '86400', // 预检请求的缓存时间（24小时）
    };
    if (!url) return Response.json({ message: 'Missing required parameter: url.' }); // 检查URL参数是否存在

    // URL格式检查
    if (!/^https?:\/\/.{3,}/.test(url)) {
        return Response.json({ message: 'Illegal format: url.' }, {
            headers: corsHeaders,
            status: 400 // 返回400错误，表示请求格式不合法
        });
    }

    // 自定义slug长度检查
    if (slug && (slug.length < 2 || slug.length > 10 || /.+\.[a-zA-Z]+$/.test(slug))) {
        return Response.json({ message: 'Illegal length: slug, (>= 2 && <= 10), or not ending with a file extension.' }, {
            headers: corsHeaders,
            status: 400 // 返回400错误，表示slug长度不合法或以文件后缀结尾
        });
    }

    try {
        // 如果有自定义slug
        if (slug) {
            const existUrl = await env.DB.prepare(`SELECT url as existUrl FROM links where slug = '${slug}'`).first(); // 查询数据库中是否存在相同的slug

            // 如果url和slug匹配
            if (existUrl && existUrl.existUrl === url) {
                return Response.json({ slug, link: `${origin}/${slug}` }, {
                    headers: corsHeaders,
                    status: 200 // 返回200状态，表示请求成功
                });
            }

            // 如果slug已存在
            if (existUrl) {
                return Response.json({ message: 'Slug already exists.' }, {
                    headers: corsHeaders,
                    status: 200 // 返回200状态，表示slug已存在
                });
            }
        }

        // 检查目标url是否已存在
        const existSlug = await env.DB.prepare(`SELECT slug as existSlug FROM links where url = '${url}'`).first();

        // 如果url存在且没有自定义slug
        if (existSlug && !slug) {
            return Response.json({ slug: existSlug.existSlug, link: `${origin}/${existSlug.existSlug}` }, {
                headers: corsHeaders,
                status: 200 // 返回200状态，表示请求成功
            });
        }

        const bodyUrl = new URL(url); // 解析请求体中的URL

        if (bodyUrl.hostname === originurl.hostname) { // 检查是否为同一域
            return Response.json({ message: 'You cannot shorten a link to the same domain.' }, {
                headers: corsHeaders,
                status: 400 // 返回400错误，表示不能缩短相同域的链接
            });
        }

        // 生成随机slug并指定字符串长度
        const slug2 = slug ? slug : generateRandomString(6); // 如果没有自定义slug则生成随机slug

        // 将数据插入数据库
        const info = await env.DB.prepare(`INSERT INTO links (url, slug, ip, status, ua, create_time) 
        VALUES ('${url}', '${slug2}', '${clientIP}', 1, '${userAgent}', '${formattedDate}')`).run();

        return Response.json({ slug: slug2, link: `${origin}/${slug2}` }, {
            headers: corsHeaders,
            status: 200 // 返回200状态，表示请求成功
        });
    } catch (e) {
        // 捕获异常并返回500错误
        return Response.json({ message: e.message }, {
            headers: corsHeaders,
            status: 500 // 返回500状态，表示服务器内部错误
        });
    }
}
