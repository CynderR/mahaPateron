const axios = require('axios');

class PatreonService {
  constructor() {
    this.baseURL = 'https://www.patreon.com/api/oauth2/v2';
    this.accessToken = null;
    this.campaignId = null;
  }

  // Set the Patreon access token
  setAccessToken(token) {
    this.accessToken = token;
  }

  // Set the campaign ID
  setCampaignId(campaignId) {
    this.campaignId = campaignId;
  }

  // Get headers for API requests
  getHeaders() {
    if (!this.accessToken) {
      throw new Error('Patreon access token not set');
    }
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json'
    };
  }

  // Test the connection and get campaign info
  async testConnection() {
    try {
      const response = await axios.get(`${this.baseURL}/campaigns`, {
        headers: this.getHeaders()
      });

      if (response.data && response.data.data && response.data.data.length > 0) {
        const campaign = response.data.data[0];
        this.campaignId = campaign.id;
        return {
          success: true,
          campaign: {
            id: campaign.id,
            name: campaign.attributes.title || 'Untitled Campaign',
            url: campaign.attributes.url || '',
            patron_count: campaign.attributes.patron_count || null,
            pledge_sum: campaign.attributes.pledge_sum || null
          }
        };
      } else {
        return {
          success: false,
          error: 'No campaigns found'
        };
      }
    } catch (error) {
      console.error('Patreon API test connection error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.errors?.[0]?.detail || error.message
      };
    }
  }

  // Get active patrons/subscribers
  async getActivePatrons() {
    if (!this.accessToken) {
      throw new Error('Access token not set');
    }
    if (!this.campaignId) {
      throw new Error('Campaign ID not set. Please test connection first.');
    }
    const url = `https://www.patreon.com/api/oauth2/v2/campaigns/${this.campaignId}/members?include=user,currently_entitled_tiers&fields[user]=email,first_name,last_name,full_name,vanity,url&fields[tier]=title,amount_cents,description`;

    try {
      const response = await axios.get(
        url,
        {
          headers: this.getHeaders()
        }
      );


      const patrons = [];
      
      if (response.data && response.data.data) {
        for (const member of response.data.data) {
          const patron = {
            id: member.id,
            patron_status: member.attributes.patron_status,
            pledge_relationship_start: member.attributes.pledge_relationship_start,
            pledge_amount_cents: member.attributes.pledge_amount_cents,
            pledge_created_at: member.attributes.pledge_created_at,
            pledge_declined_since: member.attributes.pledge_declined_since,
            will_pay_amount_cents: member.attributes.will_pay_amount_cents,
            user: null,
            tier: null
          };

          // Get user information from included data
          if (member.relationships && member.relationships.user && response.data.included) {
            const userId = member.relationships.user.data.id;
            const userData = response.data.included.find(item => item.type === 'user' && item.id === userId);
            if (userData) {
              patron.user = {
                id: userData.id,
                email: userData.attributes.email,
                first_name: userData.attributes.first_name,
                last_name: userData.attributes.last_name,
                full_name: userData.attributes.full_name,
                vanity: userData.attributes.vanity,
                image_url: userData.attributes.image_url,
                created: userData.attributes.created,
                url: userData.attributes.url
              };
            }
          }

          // Get tier information from included data
          if (member.relationships && member.relationships.currently_entitled_tiers && response.data.included) {
            const tierIds = member.relationships.currently_entitled_tiers.data.map(tier => tier.id);
            const tierData = response.data.included.filter(item => 
              item.type === 'tier' && tierIds.includes(item.id)
            );
            if (tierData.length > 0) {
              patron.tier = tierData.map(tier => ({
                id: tier.id,
                title: tier.attributes.title,
                description: tier.attributes.description,
                amount_cents: tier.attributes.amount_cents,
                created_at: tier.attributes.created_at,
                url: tier.attributes.url
              }));
            }
          }

          patrons.push(patron);
        }
      }

      return {
        success: true,
        patrons: patrons,
        total: patrons.length,
        pagination: response.data.links || {}
      };

    } catch (error) {
      console.error('Patreon API get patrons error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.errors?.[0]?.detail || error.message
      };
    }
  }

  // Get all patrons (including inactive)
  async getAllPatrons() {
    if (!this.campaignId) {
      throw new Error('Campaign ID not set. Please test connection first.');
    }

    try {
      const response = await axios.get(
        `${this.baseURL}/campaigns/${this.campaignId}/members?include=user,currently_entitled_tiers`,
        {
          headers: this.getHeaders()
        }
      );

      const patrons = [];
      
      if (response.data && response.data.data) {
        for (const member of response.data.data) {
          const patron = {
            id: member.id,
            patron_status: member.attributes.patron_status,
            pledge_relationship_start: member.attributes.pledge_relationship_start,
            pledge_amount_cents: member.attributes.pledge_amount_cents,
            pledge_created_at: member.attributes.pledge_created_at,
            pledge_declined_since: member.attributes.pledge_declined_since,
            will_pay_amount_cents: member.attributes.will_pay_amount_cents,
            user: null,
            tier: null
          };

          // Get user information from included data
          if (member.relationships && member.relationships.user && response.data.included) {
            const userId = member.relationships.user.data.id;
            const userData = response.data.included.find(item => item.type === 'user' && item.id === userId);
            if (userData) {
              patron.user = {
                id: userData.id,
                email: userData.attributes.email,
                first_name: userData.attributes.first_name,
                last_name: userData.attributes.last_name,
                full_name: userData.attributes.full_name,
                vanity: userData.attributes.vanity,
                image_url: userData.attributes.image_url,
                created: userData.attributes.created,
                url: userData.attributes.url
              };
            }
          }

          // Get tier information from included data
          if (member.relationships && member.relationships.currently_entitled_tiers && response.data.included) {
            const tierIds = member.relationships.currently_entitled_tiers.data.map(tier => tier.id);
            const tierData = response.data.included.filter(item => 
              item.type === 'tier' && tierIds.includes(item.id)
            );
            if (tierData.length > 0) {
              patron.tier = tierData.map(tier => ({
                id: tier.id,
                title: tier.attributes.title,
                description: tier.attributes.description,
                amount_cents: tier.attributes.amount_cents,
                created_at: tier.attributes.created_at,
                url: tier.attributes.url
              }));
            }
          }

          patrons.push(patron);
        }
      }

      return {
        success: true,
        patrons: patrons,
        total: patrons.length,
        pagination: response.data.links || {}
      };

    } catch (error) {
      console.error('Patreon API get all patrons error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.errors?.[0]?.detail || error.message
      };
    }
  }

  // Get campaign tiers
  async getCampaignTiers() {
    if (!this.campaignId) {
      throw new Error('Campaign ID not set. Please test connection first.');
    }

    try {
      const response = await axios.get(
        `${this.baseURL}/campaigns/${this.campaignId}/tiers`,
        {
          headers: this.getHeaders()
        }
      );

      const tiers = [];
      
      if (response.data && response.data.data) {
        for (const tier of response.data.data) {
          tiers.push({
            id: tier.id,
            title: tier.attributes.title,
            description: tier.attributes.description,
            amount_cents: tier.attributes.amount_cents,
            created_at: tier.attributes.created_at,
            url: tier.attributes.url,
            patron_count: tier.attributes.patron_count
          });
        }
      }

      return {
        success: true,
        tiers: tiers
      };

    } catch (error) {
      console.error('Patreon API get tiers error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.errors?.[0]?.detail || error.message
      };
    }
  }

  // Get RSS feed URL for the campaign
  async getRSSUrl() {
    if (!this.campaignId) {
      throw new Error('Campaign ID not set. Please test connection first.');
    }

    try {
      const response = await axios.get(
        `${this.baseURL}/campaigns/${this.campaignId}`,
        {
          headers: this.getHeaders(),
          params: {
            'fields[campaign]': 'vanity,url,creation_name'
          }
        }
      );

      console.log('getRSSUrl: Campaign response:', JSON.stringify(response.data, null, 2));

      if (response.data && response.data.data) {
        const campaign = response.data.data;
        const vanity = campaign.attributes?.vanity;
        const url = campaign.attributes?.url;
        const creationName = campaign.attributes?.creation_name;
        
        // Construct RSS URL from vanity, URL, or creation_name
        if (vanity) {
          const rssUrl = `https://www.patreon.com/rss/${vanity}`;
          console.log('getRSSUrl: Using vanity, RSS URL:', rssUrl);
          return rssUrl;
        } else if (url) {
          // Extract vanity from URL if available
          const urlMatch = url.match(/patreon\.com\/([^\/\?]+)/);
          if (urlMatch && urlMatch[1]) {
            const rssUrl = `https://www.patreon.com/rss/${urlMatch[1]}`;
            console.log('getRSSUrl: Using URL match, RSS URL:', rssUrl);
            return rssUrl;
          }
        } else if (creationName) {
          // Fallback to creation_name
          const rssUrl = `https://www.patreon.com/rss/${creationName}`;
          console.log('getRSSUrl: Using creation_name, RSS URL:', rssUrl);
          return rssUrl;
        }
      }

      console.log('getRSSUrl: No RSS URL could be constructed');
      return null;
    } catch (error) {
      console.error('Patreon API get RSS URL error:', error.response?.data || error.message);
      console.error('Patreon API get RSS URL error stack:', error.stack);
      return null;
    }
  }

  // Get posts from RSS feed (parse RSS)
  async getPostsFromRSS(rssUrl) {
    if (!rssUrl) {
      return { success: false, error: 'RSS URL not provided' };
    }

    try {
      console.log('getPostsFromRSS: Fetching RSS from:', rssUrl);
      const response = await axios.get(rssUrl, {
        headers: {
          'Accept': 'application/rss+xml, application/xml, text/xml, */*',
          'User-Agent': 'Mozilla/5.0 (compatible; PatreonRSS/1.0)'
        },
        timeout: 10000
      });

      console.log('getPostsFromRSS: Response status:', response.status);
      console.log('getPostsFromRSS: Response content type:', response.headers['content-type']);
      console.log('getPostsFromRSS: Response data length:', response.data?.length || 0);

      // Parse RSS XML (simple parsing)
      const xmlText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      const posts = [];
      
      // Extract items from RSS
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match;
      let count = 0;
      
      while ((match = itemRegex.exec(xmlText)) !== null && count < 10) {
        const itemContent = match[1];
        
        const titleMatch = itemContent.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/);
        const linkMatch = itemContent.match(/<link>(.*?)<\/link>|<link><!\[CDATA\[(.*?)\]\]><\/link>/);
        const pubDateMatch = itemContent.match(/<pubDate>(.*?)<\/pubDate>/);
        const descriptionMatch = itemContent.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>|<description>(.*?)<\/description>/);
        
        if (titleMatch || linkMatch) {
          posts.push({
            title: titleMatch ? (titleMatch[1] || titleMatch[2] || '').trim() : 'Untitled',
            link: linkMatch ? (linkMatch[1] || linkMatch[2] || '').trim() : '',
            pubDate: pubDateMatch ? pubDateMatch[1].trim() : '',
            description: descriptionMatch ? (descriptionMatch[1] || descriptionMatch[2] || '').trim().substring(0, 200) : ''
          });
          count++;
        }
      }

      console.log('getPostsFromRSS: Parsed', posts.length, 'posts');

      return {
        success: true,
        posts: posts
      };
    } catch (error) {
      console.error('Error fetching RSS feed:', error.message);
      console.error('Error details:', {
        response: error.response?.status,
        data: error.response?.data?.substring(0, 200),
        url: rssUrl
      });
      return {
        success: false,
        error: error.message || 'Failed to fetch RSS feed'
      };
    }
  }
}

module.exports = PatreonService;
