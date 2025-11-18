// Supabase Configuration
const SUPABASE_URL = 'https://jdyqevwzvczmcqrpogpw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkeXFldnd6dmN6bWNxcnBvZ3B3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0MDI2NjgsImV4cCI6MjA3ODk3ODY2OH0.58-IHikNEIkrS-xpIQfgLbDHUyyxSuOOzaEjehx0Mak';

// Initialize Supabase client
let supabase = null;
if (SUPABASE_URL && SUPABASE_URL !== 'YOUR_SUPABASE_URL' && SUPABASE_ANON_KEY && SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY') {
    try {
        if (window.supabase && typeof window.supabase.createClient === 'function') {
            supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        } else {
            console.warn('Supabase library not loaded. Please ensure @supabase/supabase-js is loaded before supabaseService.js');
        }
    } catch (error) {
        console.error('Failed to initialize Supabase client:', error);
    }
}

// ==================== AUTHENTICATION ====================

async function signUp(email, password, displayName) {
    if (!supabase) {
        showMessage('Supabase not configured. Please add your credentials.', 'error');
        return null;
    }
    
    try {
        // Get the current page URL for redirect
        const redirectUrl = window.location.origin + window.location.pathname;
        
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    display_name: displayName
                },
                emailRedirectTo: redirectUrl
            }
        });
        
        if (error) throw error;
        
        return data;
    } catch (error) {
        console.error('Sign up error:', error);
        throw error;
    }
}

async function signIn(email, password) {
    if (!supabase) {
        showMessage('Supabase not configured. Please add your credentials.', 'error');
        return null;
    }
    
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) throw error;
        
        return data;
    } catch (error) {
        console.error('Sign in error:', error);
        throw error;
    }
}


async function signOut() {
    if (!supabase) return;
    
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    } catch (error) {
        console.error('Sign out error:', error);
        throw error;
    }
}

async function getCurrentUser() {
    if (!supabase) return null;
    
    try {
        const { data: { user } } = await supabase.auth.getUser();
        return user;
    } catch (error) {
        console.error('Get user error:', error);
        return null;
    }
}

async function getCurrentSession() {
    if (!supabase) return null;
    
    try {
        const { data: { session } } = await supabase.auth.getSession();
        return session;
    } catch (error) {
        console.error('Get session error:', error);
        return null;
    }
}

// Listen for auth state changes
function onAuthStateChange(callback) {
    if (!supabase) return;
    
    supabase.auth.onAuthStateChange((event, session) => {
        callback(event, session);
    });
}

// ==================== RANKINGS STORAGE ====================

async function saveRankingToCloud(ranking) {
    if (!supabase) {
        // Fallback to localStorage
        return saveRankingToHistoryLocal(ranking.rankedMovies, ranking.unseenMovies);
    }
    
    const user = await getCurrentUser();
    if (!user) {
        // Not logged in, save to localStorage
        return saveRankingToHistoryLocal(ranking.rankedMovies, ranking.unseenMovies);
    }
    
    try {
        const { data, error } = await supabase
            .from('rankings')
            .insert({
                user_id: user.id,
                list_name: ranking.listName,
                list_type: ranking.type,
                ranked_movies: ranking.rankedMovies,
                unseen_movies: ranking.unseenMovies || [],
                total_comparisons: ranking.totalComparisons,
                created_at: new Date().toISOString()
            })
            .select()
            .single();
        
        if (error) throw error;
        
        // Also save to localStorage as backup
        saveRankingToHistoryLocal(ranking.rankedMovies, ranking.unseenMovies);
        
        return data;
    } catch (error) {
        console.error('Save ranking error:', error);
        // Fallback to localStorage
        saveRankingToHistoryLocal(ranking.rankedMovies, ranking.unseenMovies);
        throw error;
    }
}

async function loadRankingsFromCloud() {
    if (!supabase) {
        return loadRankingsFromLocal();
    }
    
    const user = await getCurrentUser();
    if (!user) {
        return loadRankingsFromLocal();
    }
    
    try {
        const { data, error } = await supabase
            .from('rankings')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(50);
        
        if (error) throw error;
        
        // Merge with local rankings and sync
        const localRankings = loadRankingsFromLocal();
        const cloudRankings = data.map(r => ({
            id: r.id.toString(),
            timestamp: new Date(r.created_at).getTime(),
            listName: r.list_name,
            type: r.list_type,
            rankedMovies: r.ranked_movies,
            unseenMovies: r.unseen_movies || [],
            totalComparisons: r.total_comparisons
        }));
        
        // Combine and deduplicate
        const allRankings = [...cloudRankings, ...localRankings];
        const uniqueRankings = Array.from(
            new Map(allRankings.map(r => [r.id, r])).values()
        );
        
        return uniqueRankings.sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);
    } catch (error) {
        console.error('Load rankings error:', error);
        return loadRankingsFromLocal();
    }
}

// ==================== CUSTOM LISTS STORAGE ====================

async function saveCustomListToCloud(listName, items, isPublic = false) {
    if (!supabase) {
        return saveCustomListLocal(listName, items);
    }
    
    const user = await getCurrentUser();
    if (!user) {
        return saveCustomListLocal(listName, items);
    }
    
    try {
        const { data, error } = await supabase
            .from('custom_lists')
            .insert({
                user_id: user.id,
                name: listName,
                items: items,
                is_public: isPublic,
                created_at: new Date().toISOString()
            })
            .select()
            .single();
        
        if (error) throw error;
        
        // Don't save to localStorage when saving to cloud to avoid duplicates
        // The cloud is the source of truth when user is logged in
        // localStorage will be synced when loading lists
        
        return data;
    } catch (error) {
        console.error('Save custom list error:', error);
        return saveCustomListLocal(listName, items);
    }
}

async function loadCustomListsFromCloud() {
    if (!supabase) {
        return loadCustomListsFromLocal();
    }
    
    const user = await getCurrentUser();
    if (!user) {
        return loadCustomListsFromLocal();
    }
    
    try {
        const { data, error } = await supabase
            .from('custom_lists')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        // Merge with local lists
        const localLists = loadCustomListsFromLocal();
        const cloudLists = data.map(l => ({
            id: l.id.toString(),
            name: l.name,
            created: new Date(l.created_at).getTime(),
            items: l.items,
            isPublic: l.is_public || false
        }));
        
        // Combine and deduplicate - prefer cloud lists over local
        // First, deduplicate by ID
        const allLists = [...cloudLists, ...localLists];
        const byId = new Map();
        allLists.forEach(l => {
            const id = l.id.toString();
            // Prefer cloud list if both exist (cloud lists come first in array)
            if (!byId.has(id) || cloudLists.some(cl => cl.id.toString() === id)) {
                byId.set(id, l);
            }
        });
        
        // Then, deduplicate by name and items to catch duplicates with different IDs
        const uniqueLists = [];
        const seen = new Set();
        
        Array.from(byId.values()).forEach(list => {
            // Create a signature based on name and items
            const itemsSignature = JSON.stringify(list.items.map(i => ({ 
                title: i.title, 
                id: i.id 
            })).sort((a, b) => (a.title || '').localeCompare(b.title || ''))));
            const signature = `${list.name}::${itemsSignature}`;
            
            if (!seen.has(signature)) {
                seen.add(signature);
                uniqueLists.push(list);
            } else {
                // If duplicate found, prefer cloud list (has numeric string ID from database)
                const existing = uniqueLists.find(l => {
                    const existingSig = `${l.name}::${JSON.stringify(l.items.map(i => ({ 
                        title: i.title, 
                        id: i.id 
                    })).sort((a, b) => (a.title || '').localeCompare(b.title || '')))}`;
                    return existingSig === signature;
                });
                // Replace with cloud list if current is cloud and existing is local
                if (existing && /^\d+$/.test(list.id) && !/^\d+$/.test(existing.id)) {
                    const index = uniqueLists.indexOf(existing);
                    uniqueLists[index] = list;
                }
            }
        });
        
        return uniqueLists;
    } catch (error) {
        console.error('Load custom lists error:', error);
        return loadCustomListsFromLocal();
    }
}

async function deleteCustomListFromCloud(listId) {
    if (!supabase) {
        return deleteCustomListLocal(listId);
    }
    
    const user = await getCurrentUser();
    if (!user) {
        return deleteCustomListLocal(listId);
    }
    
    try {
        const { error } = await supabase
            .from('custom_lists')
            .delete()
            .eq('id', listId)
            .eq('user_id', user.id);
        
        if (error) throw error;
        
        // Also delete from localStorage
        deleteCustomListLocal(listId);
        
        return true;
    } catch (error) {
        console.error('Delete custom list error:', error);
        return deleteCustomListLocal(listId);
    }
}

// ==================== COMMUNITY TEMPLATES ====================

async function loadCommunityTemplates(searchTerm = '') {
    if (!supabase) {
        return [];
    }
    
    try {
        let query = supabase
            .from('custom_lists')
            .select('*, profiles:user_id(display_name)')
            .eq('is_public', true)
            .order('created_at', { ascending: false })
            .limit(50);
        
        if (searchTerm) {
            query = query.ilike('name', `%${searchTerm}%`);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        return data.map(t => ({
            id: t.id.toString(),
            name: t.name,
            items: t.items,
            created: new Date(t.created_at).getTime(),
            author: t.profiles?.display_name || 'Anonymous',
            authorId: t.user_id
        }));
    } catch (error) {
        console.error('Load community templates error:', error);
        return [];
    }
}

async function importCommunityTemplate(templateId) {
    if (!supabase) {
        showMessage('Supabase not configured', 'error');
        return null;
    }
    
    const user = await getCurrentUser();
    if (!user) {
        showMessage('Please sign in to import templates', 'error');
        return null;
    }
    
    try {
        const { data, error } = await supabase
            .from('custom_lists')
            .select('*')
            .eq('id', templateId)
            .eq('is_public', true)
            .single();
        
        if (error) throw error;
        
        // Save as user's own list
        const { data: newList, error: saveError } = await supabase
            .from('custom_lists')
            .insert({
                user_id: user.id,
                name: `${data.name} (from community)`,
                items: data.items,
                is_public: false,
                created_at: new Date().toISOString()
            })
            .select()
            .single();
        
        if (saveError) throw saveError;
        
        return newList;
    } catch (error) {
        console.error('Import template error:', error);
        throw error;
    }
}

// ==================== LOCALSTORAGE FALLBACKS ====================

function saveRankingToHistoryLocal(rankedMovies, unseenMovies = []) {
    try {
        const history = JSON.parse(localStorage.getItem('ranking_history') || '[]');
        const ranking = {
            id: Date.now().toString(),
            timestamp: Date.now(),
            listName: getCurrentListName(),
            type: loadTypeSelect.value,
            rankedMovies: rankedMovies,
            unseenMovies: unseenMovies,
            totalComparisons: comparisonsMade
        };
        history.unshift(ranking);
        if (history.length > 50) history.length = 50;
        localStorage.setItem('ranking_history', JSON.stringify(history));
    } catch (e) {
        console.warn('Failed to save ranking locally:', e);
    }
}

function loadRankingsFromLocal() {
    try {
        return JSON.parse(localStorage.getItem('ranking_history') || '[]');
    } catch (e) {
        return [];
    }
}

function saveCustomListLocal(listName, items) {
    try {
        const lists = JSON.parse(localStorage.getItem('custom_ranking_lists') || '[]');
        const newList = {
            id: Date.now().toString(),
            name: listName,
            created: Date.now(),
            items: items
        };
        lists.push(newList);
        localStorage.setItem('custom_ranking_lists', JSON.stringify(lists));
        return newList;
    } catch (e) {
        console.warn('Failed to save custom list locally:', e);
        return null;
    }
}

function loadCustomListsFromLocal() {
    try {
        return JSON.parse(localStorage.getItem('custom_ranking_lists') || '[]');
    } catch (e) {
        return [];
    }
}

function deleteCustomListLocal(listId) {
    try {
        let lists = JSON.parse(localStorage.getItem('custom_ranking_lists') || '[]');
        lists = lists.filter(l => l.id !== listId);
        localStorage.setItem('custom_ranking_lists', JSON.stringify(lists));
        return true;
    } catch (e) {
        console.warn('Failed to delete custom list locally:', e);
        return false;
    }
}

// Expose functions globally - always define even if Supabase isn't loaded
window.supabaseService = {
    supabase, // Expose client for direct access if needed
    signUp,
    signIn,
    signOut,
    getCurrentUser,
    getCurrentSession,
    onAuthStateChange,
    saveRankingToCloud,
    loadRankingsFromCloud,
    saveCustomListToCloud,
    loadCustomListsFromCloud,
    deleteCustomListFromCloud,
    loadCommunityTemplates,
    importCommunityTemplate,
    loadCustomListsFromLocal // Expose local function for fallback
};

// If Supabase library loads later, try to initialize
if (!supabase && window.supabase && typeof window.supabase.createClient === 'function') {
    try {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        window.supabaseService.supabase = supabase;
    } catch (error) {
        console.error('Failed to initialize Supabase client on delayed load:', error);
    }
}

