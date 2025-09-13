// ==UserScript==
// @name         Instagram Full Followers/Following & Analysis
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Scrape followers/following, analyze mutuals/fans/idols, download all files
// @author       You
// @match        https://www.instagram.com/*/
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const BATCH_SIZE = 50;

    // Utility to download text file
    function downloadTxt(content, filename) {
        const blob = new Blob([content.join('\n')], { type: 'text/plain' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
    }

    // Get user ID from profile page HTML
    async function getUserId(username) {
        const res = await fetch(`https://www.instagram.com/${username}/`, { credentials: 'include' });
        const text = await res.text();
        const m = text.match(/"profilePage_(\d+)"/);
        if (!m) throw new Error('Could not extract user ID. Make sure you are logged in and entered the correct username.');
        return m[1];
    }

    // Fetch users from GraphQL endpoint
    async function fetchUsersById(userId, type = 'followers') {
        const collectedUsers = [];
        let hasNextPage = true;
        let endCursor = null;

        const queryHash = type === 'followers' 
            ? 'c76146de99bb02f6415203be841dd25a' 
            : 'd04b0a864b4b54837c0d870b0e77e076';

        while (hasNextPage) {
            const url = `https://www.instagram.com/graphql/query/?query_hash=${queryHash}&variables=${encodeURIComponent(JSON.stringify({
                id: userId,
                first: BATCH_SIZE,
                after: endCursor
            }))}`;

            const r = await fetch(url, {
                credentials: 'include',
                headers: { 'x-requested-with': 'XMLHttpRequest' }
            });

            if (!r.ok) {
                console.error('Fetch error:', r.status);
                break;
            }

            const j = await r.json();
            const edges = type === 'followers' 
                ? j.data.user.edge_followed_by?.edges || [] 
                : j.data.user.edge_follow?.edges || [];

            edges.forEach(edge => collectedUsers.push(edge.node.username));

            const pageInfo = type === 'followers' 
                ? j.data.user.edge_followed_by?.page_info 
                : j.data.user.edge_follow?.page_info;

            hasNextPage = pageInfo?.has_next_page || false;
            endCursor = pageInfo?.end_cursor || null;

            console.log(`${type}: collected ${collectedUsers.length} users so far`);
        }

        return collectedUsers;
    }

    // Analyze mutuals/fans/idols
    function analyzeRelations(followers, following) {
        const followersSet = new Set(followers);
        const followingSet = new Set(following);

        const mutuals = followers.filter(u => followingSet.has(u));
        const fans = followers.filter(u => !followingSet.has(u));
        const idols = following.filter(u => !followersSet.has(u));

        return { mutuals, fans, idols };
    }

    // Add button to page
    const btn = document.createElement('button');
    btn.innerText = 'Scrape & Analyze Followers/Following';
    btn.style.position = 'fixed';
    btn.style.top = '10px';
    btn.style.right = '10px';
    btn.style.zIndex = 9999;
    btn.style.padding = '10px';
    btn.style.background = '#3897f0';
    btn.style.color = '#fff';
    btn.style.border = 'none';
    btn.style.borderRadius = '5px';
    btn.style.cursor = 'pointer';

    btn.onclick = async () => {
        const username = prompt('Enter Instagram username:');
        if (!username) return;

        btn.disabled = true;
        btn.innerText = 'Scraping... check console for progress';

        try {
            const userId = await getUserId(username);
            console.log('User ID:', userId);

            const followers = await fetchUsersById(userId, 'followers');
            downloadTxt(followers, `${username}_followers.txt`);

            const following = await fetchUsersById(userId, 'following');
            downloadTxt(following, `${username}_following.txt`);

            console.log('Followers and Following downloaded.');

            const { mutuals, fans, idols } = analyzeRelations(followers, following);

            downloadTxt(mutuals, `${username}_mutuals_friends.txt`);
            downloadTxt(fans, `${username}_fans.txt`);
            downloadTxt(idols, `${username}_idols.txt`);

            alert(`Done! 
Followers: ${followers.length}
Following: ${following.length}
Mutuals: ${mutuals.length}
Fans: ${fans.length}
Idols: ${idols.length}`);
            console.log('Analysis complete.');

        } catch (e) {
            alert('Error: ' + e.message);
            console.error(e);
        }

        btn.disabled = false;
        btn.innerText = 'Scrape & Analyze Followers/Following';
    };

    document.body.appendChild(btn);

})();
