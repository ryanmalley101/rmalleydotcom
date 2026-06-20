// WorldAnvil BBCode → Markdown converter, shared by the import flow and
// the wiki "fix formatting" bulk action for already-imported articles.

export function hasBBCode(text: string): boolean {
    return /\[\/?(?:p|b|i|u|s|h[1-6]|ul|ol|li|br|hr|url|img|color|size|quote|sidebar|table|tr|th|td|row|col|section|container|block|code|pre)\b/i.test(text);
}

export function convertBBCodeToMarkdown(text: string): string {
    let s = text;

    // Block headings
    s = s.replace(/\[h1\]([\s\S]*?)\[\/h1\]/gi, (_, c) => `\n# ${c.trim()}\n`);
    s = s.replace(/\[h2\]([\s\S]*?)\[\/h2\]/gi, (_, c) => `\n## ${c.trim()}\n`);
    s = s.replace(/\[h3\]([\s\S]*?)\[\/h3\]/gi, (_, c) => `\n### ${c.trim()}\n`);
    s = s.replace(/\[h4\]([\s\S]*?)\[\/h4\]/gi, (_, c) => `\n#### ${c.trim()}\n`);
    s = s.replace(/\[h5\]([\s\S]*?)\[\/h5\]/gi, (_, c) => `\n##### ${c.trim()}\n`);
    s = s.replace(/\[h6\]([\s\S]*?)\[\/h6\]/gi, (_, c) => `\n###### ${c.trim()}\n`);

    // Lists — items first, then strip wrappers
    s = s.replace(/\[li\]([\s\S]*?)\[\/li\]/gi, (_, c) => `- ${c.trim()}\n`);
    s = s.replace(/\[ul\]([\s\S]*?)\[\/ul\]/gi, (_, c) => `\n${c.trim()}\n`);
    s = s.replace(/\[ol\]([\s\S]*?)\[\/ol\]/gi, (_, c) => `\n${c.trim()}\n`);

    // Paragraphs — empty ones become nothing
    s = s.replace(/\[p\]([\s\S]*?)\[\/p\]/gi, (_, c) => {
        const inner = c.trim();
        return inner ? `${inner}\n\n` : "";
    });

    // Dividers and breaks
    s = s.replace(/\[hr\]/gi, "\n\n---\n\n");
    s = s.replace(/\[br\]/gi, "\n");

    // Blockquotes / sidebars
    s = s.replace(/\[(?:quote|sidebar)\]([\s\S]*?)\[\/(?:quote|sidebar)\]/gi, (_, c) =>
        c.trim().split("\n").map((l: string) => `> ${l}`).join("\n") + "\n\n"
    );

    // Tables (basic — th row becomes header)
    s = s.replace(/\[table\]([\s\S]*?)\[\/table\]/gi, (_, tableContent) => {
        const rowPattern = /\[tr\]([\s\S]*?)\[\/tr\]/gi;
        const rows: string[][] = [];
        let hasHeader = false;
        let rm;
        while ((rm = rowPattern.exec(tableContent)) !== null) {
            const cells: string[] = [];
            const thPat = /\[th\]([\s\S]*?)\[\/th\]/gi;
            let tm;
            while ((tm = thPat.exec(rm[1])) !== null) { cells.push(tm[1].trim()); hasHeader = true; }
            const tdPat = /\[td\]([\s\S]*?)\[\/td\]/gi;
            while ((tm = tdPat.exec(rm[1])) !== null) { cells.push(tm[1].trim()); }
            if (cells.length) rows.push(cells);
        }
        if (!rows.length) return "";
        const header = hasHeader ? rows[0] : rows[0].map((_, i) => `Column ${i + 1}`);
        const data   = hasHeader ? rows.slice(1) : rows;
        const sep    = header.map(() => "---");
        return [
            `\n| ${header.join(" | ")} |`,
            `| ${sep.join(" | ")} |`,
            ...data.map(r => `| ${r.join(" | ")} |`),
        ].join("\n") + "\n\n";
    });

    // Inline formatting
    s = s.replace(/\[b\]([\s\S]*?)\[\/b\]/gi,    "**$1**");
    s = s.replace(/\[i\]([\s\S]*?)\[\/i\]/gi,    "*$1*");
    s = s.replace(/\[s\]([\s\S]*?)\[\/s\]/gi,    "~~$1~~");
    s = s.replace(/\[u\]([\s\S]*?)\[\/u\]/gi,    "$1");
    s = s.replace(/\[sup\]([\s\S]*?)\[\/sup\]/gi, "$1");
    s = s.replace(/\[sub\]([\s\S]*?)\[\/sub\]/gi, "$1");
    s = s.replace(/\[code\]([\s\S]*?)\[\/code\]/gi, "`$1`");
    s = s.replace(/\[pre\]([\s\S]*?)\[\/pre\]/gi,  "```\n$1\n```");

    // Colors / sizes / fonts — strip tags, keep inner text
    s = s.replace(/\[color=[^\]]*\]([\s\S]*?)\[\/color\]/gi, "$1");
    s = s.replace(/\[size=[^\]]*\]([\s\S]*?)\[\/size\]/gi,   "$1");
    s = s.replace(/\[font=[^\]]*\]([\s\S]*?)\[\/font\]/gi,   "$1");

    // Links and images
    s = s.replace(/\[url=([^\]]*)\]([\s\S]*?)\[\/url\]/gi, "[$2]($1)");
    s = s.replace(/\[url\]([\s\S]*?)\[\/url\]/gi,          "$1");
    s = s.replace(/\[img[^\]]*\]([\s\S]*?)\[\/img\]/gi,    "![]($1)");

    // Layout wrappers — strip, keep content
    s = s.replace(/\[row\]([\s\S]*?)\[\/row\]/gi,                     "$1");
    s = s.replace(/\[col(?:=[^\]]*)?\]([\s\S]*?)\[\/col\]/gi,         "$1\n");
    s = s.replace(/\[section(?::[^\]]*)?\]([\s\S]*?)\[\/section\]/gi, "$1");
    s = s.replace(/\[container(?::[^\]]*)?\]([\s\S]*?)\[\/container\]/gi, "$1");
    s = s.replace(/\[block(?::[^\]]*)?\]([\s\S]*?)\[\/block\]/gi,     "$1");

    // WorldAnvil entity mentions: [type:id|Display Name] → Display Name
    s = s.replace(/\[[a-z]+:[^\|]*\|([^\]]*)\]/gi, "$1");
    // Remaining [tag:attr] openers with no closing pair
    s = s.replace(/\[[a-z]+:[^\]]*\]/gi, "");
    // Any leftover [/tag] or [tag]
    s = s.replace(/\[\/[a-z0-9]+\]/gi, "");
    s = s.replace(/\[[a-z0-9]+\]/gi,   "");

    // Collapse 3+ blank lines → 2
    s = s.replace(/\n{3,}/g, "\n\n");

    return s.trim();
}

export function maybeConvert(raw: string): string {
    const s = raw.replace(/\r\n/g, "\n").trim();
    return hasBBCode(s) ? convertBBCodeToMarkdown(s) : s;
}
