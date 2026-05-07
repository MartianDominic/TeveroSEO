Corrected Proxy Pricing                                                
                                                                           
  ┌──────────────────┬─────────────────────┬───────────────────────┐       
  │     Provider     │        Price        │         Notes         │
  ├──────────────────┼─────────────────────┼───────────────────────┤       
  │ Geonode          │ $0.77/GB (50GB sub) │ Rolls over, no expiry │     
  ├──────────────────┼─────────────────────┼───────────────────────┤
  │ Geonode Flexible │ $0.30-$0.88/GB      │ Volume discounts      │       
  ├──────────────────┼─────────────────────┼───────────────────────┤       
  │ Evomi            │ $0.99/GB            │ Pay as you go         │       
  └──────────────────┴─────────────────────┴───────────────────────┘       
                                                                         
  Geonode wins - my subagent had outdated data.                            
                                                                         
  The Critical Insight You Raised: When Does Cost Incur?                   
                                                                         
  This is the key question. Let me break down the economics:               
                                                                         
  Proxy Costs: Bandwidth-Based (Per GB Transferred)                        
                                                                         
  Cost incurs at TRANSFER TIME, not processing time                        
                                                                           
  What SAVES proxy money:                                                
  ├── Compression (Brotli) → 82% less bytes transferred                    
  ├── Conditional GET (304) → ~200 bytes instead of 100KB                  
  ├── HEAD requests → Headers only, no body                                
  ├── Cache hits → No fetch at all                                         
  └── Free APIs → No fetch at all                                          
                                                                           
  What DOESN'T save proxy money:                                         
  ├── Stripping content AFTER fetch → Already downloaded                   
  ├── Discarding data AFTER parse → Already downloaded                   
  └── Efficient parsing → Already downloaded                               
                                                                         
  DataForSEO Costs: Request-Based + Feature Multipliers                    
                                                                         
  DataForSEO OnPage API Pricing (from your screenshot):                    
                                                                         
  BASE COST: $0.000125/page                                                
                                                                         
  FEATURE MULTIPLIERS:                                                     
  ├── Basic (60+ params, HTML, links)     = $0.000125  (1x)              
  ├── + Load Resources                    = $0.000375  (3x)                
  ├── + Enable JavaScript                 = $0.00125   (10x)             
  ├── + Custom JavaScript                 = $0.00025   (2x)                
  ├── + Browser Rendering                 = $0.00425   (34x)             
  ├── + Keyword Density                   = $0.00025   (2x)                
  ├── Page Screenshot                     = $0.004     (32x)             
  └── Content Parsing                     = $0.000125  (1x)                
                                                                         
  The Layered DataForSEO Strategy (Brilliant Insight)                      
                                                                         
  Your idea of trying DataForSEO in layers is excellent. Here's the full   
  implementation:                                                        
                                                                           
  Per-Domain Learning System                                             
                                               
  FIRST CRAWL OF DOMAIN (Discovery Phase):                               
  ┌─────────────────────────────────────────────────────────────────┐      
  │  Step 1: Try Proxy + Cheerio (Geonode)                         │
  │  Cost: ~$0.0000154/page (at $0.77/GB, 50KB compressed)         │       
  │                                                                 │      
  │  IF SUCCESS → Store: domain requires "proxy" tier              │       
  │  IF BLOCKED → Continue to Step 2                               │       
  └─────────────────────────────────────────────────────────────────┘      
                                │                                          
                                ▼                                          
  ┌─────────────────────────────────────────────────────────────────┐    
  │  Step 2: Try DataForSEO BASIC                                  │       
  │  Cost: $0.000125/page                                          │     
  │                                                                 │      
  │  CHECK RESPONSE:                                                │     
  │  - Word count > 100? ✓                                         │       
  │  - Has <h1>? ✓                                                 │       
  │  - Body text ratio > 5%? ✓                                     │       
  │                                                                 │      
  │  IF ALL PASS → Store: domain requires "dfs_basic" tier         │       
  │  IF LOOKS LIKE SPA (low content) → Continue to Step 3          │       
  └─────────────────────────────────────────────────────────────────┘      
                                │                                        
                                ▼                                          
  ┌─────────────────────────────────────────────────────────────────┐      
  │  Step 3: Try DataForSEO with JAVASCRIPT                        │     
  │  Cost: $0.00125/page (10x basic)                               │     
  │                                                                 │      
  │  CHECK RESPONSE:                                                │    
  │  - Content now present? ✓                                      │
  │  - Dynamic elements rendered? ✓                                │       
  │                                                                 │    
  │  IF SUCCESS → Store: domain requires "dfs_js" tier             │
  │  IF STILL EMPTY → Continue to Step 4                           │       
  └─────────────────────────────────────────────────────────────────┘      
                                │                                   
                                ▼                                        
  ┌─────────────────────────────────────────────────────────────────┐      
  │  Step 4: Try DataForSEO with BROWSER RENDERING                 │       
  │  Cost: $0.00425/page (34x basic)                               │
  │                                                                 │    
  │  This handles: Cloudflare challenges, heavy SPAs,              │       
  │  custom anti-bot, dynamic content loading                      │       
  │                                                                 │      
  │  Store: domain requires "dfs_browser" tier                     │       
  └─────────────────────────────────────────────────────────────────┘      
                                                                           
  SUBSEQUENT CRAWLS:                                                     
  ┌─────────────────────────────────────────────────────────────────┐    
  │  Look up stored tier for domain                                │       
  │  Use that tier directly (skip discovery)                       │       
  │  Periodically re-test (every 30 days) in case site changed    │        
  └─────────────────────────────────────────────────────────────────┘      
                                                                           
  Cost Impact of Layered Approach                                          
                                                                           
  ┌─────────────────────────┬────────────┬─────────────┬───────────┐       
  │       Domain Type       │ % of Sites │  Tier Used  │ Cost/Page │     
  ├─────────────────────────┼────────────┼─────────────┼───────────┤     
  │ Simple static/WordPress │ 65%        │ Proxy       │ $0.000015 │       
  ├─────────────────────────┼────────────┼─────────────┼───────────┤     
  │ Protected but static    │ 15%        │ DFS Basic   │ $0.000125 │       
  ├─────────────────────────┼────────────┼─────────────┼───────────┤       
  │ Light SPA               │ 12%        │ DFS JS      │ $0.00125  │     
  ├─────────────────────────┼────────────┼─────────────┼───────────┤       
  │ React/Vue/Angular SPA   │ 6%         │ DFS JS      │ $0.00125  │       
  ├─────────────────────────┼────────────┼─────────────┼───────────┤       
  │ Heavy Cloudflare + SPA  │ 2%         │ DFS Browser │ $0.00425  │     
  └─────────────────────────┴────────────┴─────────────┴───────────┘       
                                                                           
  Weighted Average: $0.000015×0.65 + $0.000125×0.15 + $0.00125×0.18 +      
  $0.00425×0.02 = $0.000339/page                                           
                                                                         
  vs using DFS Browser for everything: $0.00425/page                       
                                                                           
  Savings: 92%                                                           
                                                                         
  DataForSEO vs Proxy: The Real Math                                       
                                                                         
  Let me calculate when each is cheaper:                                 
                                                                         
  Scenario: 100KB HTML page (compressed to ~20KB with Brotli)              
                                                                         
  ┌──────────────────────────┬────────────────────┬────────────┐           
  │          Method          │    Calculation     │ Cost/Page  │         
  ├──────────────────────────┼────────────────────┼────────────┤           
  │ Geonode $0.77/GB         │ 0.00002 GB × $0.77 │ $0.0000154 │         
  ├──────────────────────────┼────────────────────┼────────────┤           
  │ Geonode $0.30/GB (scale) │ 0.00002 GB × $0.30 │ $0.000006  │         
  ├──────────────────────────┼────────────────────┼────────────┤           
  │ DataForSEO Basic         │ Fixed              │ $0.000125  │         
  ├──────────────────────────┼────────────────────┼────────────┤         
  │ DataForSEO JS            │ Fixed              │ $0.00125   │           
  ├──────────────────────────┼────────────────────┼────────────┤           
  │ DataForSEO Browser       │ Fixed              │ $0.00425   │           
  └──────────────────────────┴────────────────────┴────────────┘           
                                                                         
  Key insight: Proxy is 8-20x cheaper than DataForSEO Basic for raw HTML.  
                                                                         
  But DataForSEO gives you parsed data - if you need 60+ on-page parameters
   extracted, their Basic tier might save engineering time.              
                                                                           
  When to Use Each                                                       
                                                                           
  ┌───────────────────────────┬────────────┬──────────────────────────┐  
  │         Use Case          │   Best     │           Why            │    
  │                           │   Choice   │                          │    
  ├───────────────────────────┼────────────┼──────────────────────────┤
  │ High volume, own parser   │ Proxy      │ 8-20x cheaper            │    
  ├───────────────────────────┼────────────┼──────────────────────────┤  
  │ Need parsed data, low     │ DFS Basic  │ Less engineering         │  
  │ volume                    │            │                          │  
  ├───────────────────────────┼────────────┼──────────────────────────┤  
  │ SPA sites                 │ DFS JS     │ Cheaper than own         │    
  │                           │            │ Playwright               │    
  ├───────────────────────────┼────────────┼──────────────────────────┤    
  │ Heavy protection          │ DFS        │ Only option              │    
  │                           │ Browser    │                          │  
  └───────────────────────────┴────────────┴──────────────────────────┘    
                                                                         
  Fresh Data Problem: Your Key Question        
                                                                         
  You asked: "if we have old data how would we know?"                    
                                                                         
  This is the critical issue. Let me break it down:                        
                                                                         
  What Needs Fresh Data (Cannot Use Common Crawl)                          
                                                                         
  ┌──────────────────┬──────────────────────────────┬──────────────────┐   
  │    Data Type     │      Why Fresh Matters       │     Solution     │ 
  ├──────────────────┼──────────────────────────────┼──────────────────┤   
  │ SERP rankings    │ Changes daily                │ DataForSEO SERP  │ 
  │                  │                              │ API              │   
  ├──────────────────┼──────────────────────────────┼──────────────────┤ 
  │ Competitor       │ For optimization             │ Proxy scrape     │ 
  │ on-page          │ recommendations              │                  │ 
  ├──────────────────┼──────────────────────────────┼──────────────────┤ 
  │ Own site audit   │ Verifying changes worked     │ Proxy scrape     │   
  ├──────────────────┼──────────────────────────────┼──────────────────┤   
  │ Keyword          │ Market conditions change     │ DataForSEO       │   
  │ difficulty       │                              │ Keywords         │   
  └──────────────────┴──────────────────────────────┴──────────────────┘ 
                                                                           
  What Can Use Stale Data (Common Crawl OK)                              
                                                                           
  ┌─────────────────────────────┬───────────────────────────┬─────────┐  
  │          Data Type          │        Why Lag OK         │ Savings │  
  ├─────────────────────────────┼───────────────────────────┼─────────┤    
  │ Competitor backlink profile │ Links don't change hourly │ FREE    │  
  ├─────────────────────────────┼───────────────────────────┼─────────┤    
  │ Historical trends           │ By definition historical  │ FREE    │  
  ├─────────────────────────────┼───────────────────────────┼─────────┤    
  │ Domain authority            │ Slow-moving metric        │ FREE    │  
  ├─────────────────────────────┼───────────────────────────┼─────────┤  
  │ Bulk competitor discovery   │ Initial research phase    │ FREE    │    
  └─────────────────────────────┴───────────────────────────┴─────────┘  
                                                                           
  The Freshness Decision Tree                                              
                                                                         
  ┌─────────────────────────────────────────────────────────────────┐      
  │                    WHAT DATA DO YOU NEED?                       │    
  └─────────────────────────────────────────────────────────────────┘      
                                │                                        
          ┌─────────────────────┼─────────────────────┐                  
          │                     │                     │                    
          ▼                     ▼                     ▼                  
  ┌───────────────┐   ┌───────────────┐   ┌───────────────┐                
  │ SERP RANKINGS │   │ PAGE CONTENT  │   │ BACKLINKS     │              
  │               │   │               │   │               │                
  │ Must be fresh │   │ Depends...    │   │ Weekly OK     │                
  │ (daily/weekly)│   │               │   │               │              
  └───────┬───────┘   └───────┬───────┘   └───────┬───────┘                
          │                   │                   │                        
          ▼                   │                   ▼                      
  ┌───────────────┐           │           ┌───────────────┐                
  │ DataForSEO    │           │           │ Common Crawl  │                
  │ SERP API      │           │           │ (FREE)        │                
  │ $0.0006/query │           │           │ or DFS monthly│                
  └───────────────┘           │           └───────────────┘                
                              │                                            
          ┌───────────────────┴───────────────────┐                      
          │                                       │                        
          ▼                                       ▼                        
  ┌───────────────────────┐       ┌───────────────────────┐              
  │ OWN SITE AUDIT        │       │ COMPETITOR ANALYSIS   │                
  │                       │       │                       │              
  │ MUST be fresh         │       │ How fresh?            │                
  │ (verify your changes) │       │                       │                
  └───────────┬───────────┘       └───────────┬───────────┘              
              │                               │                            
              ▼                               │                          
  ┌───────────────────────┐       ┌───────────┴───────────┐                
  │ Proxy + Cheerio       │       │                       │              
  │ (cheapest, real-time) │       ▼                       ▼                
  └───────────────────────┘ ┌─────────────┐   ┌─────────────────┐        
                            │ Quick check │   │ Deep analysis   │          
                            │ (what kws   │   │ (full content   │          
                            │ they rank)  │   │ audit)          │        
                            └──────┬──────┘   └────────┬────────┘          
                                   │                   │                   
                                   ▼                   ▼                   
                            ┌─────────────┐   ┌─────────────────┐          
                            │ DFS SERP    │   │ Common Crawl OK │          
                            │ (fresh)     │   │ for baseline,   │        
                            │             │   │ then spot-check │          
                            │             │   │ key pages fresh │        
                            └─────────────┘   └─────────────────┘          
                                                                         
  Position Tracking Strategy                                               
                                                                           
  Your observation is correct: "tracking positions for what keywords they  
  have could be done through a single dataforseo api call"                 
                                                                           
  Efficient Rank Tracking                                                
                                                                           
  ┌─────────────────────────────────────────────────────────────────┐    
  │                    RANK TRACKING WORKFLOW                       │      
  └─────────────────────────────────────────────────────────────────┘    
                                                                         
  STEP 1: Discover competitor keywords (ONE TIME)                        
  ├── DataForSEO Ranked Keywords API                                       
  ├── Input: competitor domain                                           
  ├── Output: All keywords they rank for                                   
  ├── Cost: $0.05 per domain + $0.0001 per keyword                         
  └── Cache: 30 days (keywords don't change fast)                        
                                                                           
  STEP 2: Track positions (ONGOING)                                      
  ├── DataForSEO SERP API (Standard Queue)                                 
  ├── Input: keyword + location                                          
  ├── Output: Full SERP with positions                                     
  ├── Cost: $0.0006/keyword                                                
  ├── Frequency: Daily for top 50, weekly for rest                         
  └── Store: Historical position data                                      
                                                                         
  STEP 3: On-page audit (WHEN NEEDED)                                      
  ├── Only when position drops or content outdated                       
  ├── Proxy + Cheerio for own site                                         
  ├── DFS Basic/JS for competitor                                        
  └── Compare against cached analysis                                      
                                                                         
  Cost Example: Track 100 Keywords Daily                                   
                                                                           
  ┌───────────────────┬────────────────────────────┬──────────────┐        
  │       Item        │        Calculation         │ Monthly Cost │        
  ├───────────────────┼────────────────────────────┼──────────────┤        
  │ Daily SERP checks │ 100 kw × $0.0006 × 30 days │ $1.80        │        
  ├───────────────────┼────────────────────────────┼──────────────┤        
  │ Weekly deep audit │ 10 pages × $0.000125 × 4   │ $0.005       │      
  ├───────────────────┼────────────────────────────┼──────────────┤        
  │ Total             │                            │ $1.81/month  │      
  └───────────────────┴────────────────────────────┴──────────────┘        
                                                                      