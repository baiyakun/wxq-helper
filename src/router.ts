import { createRouter, createWebHashHistory } from 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    /** fallback path for the header back button when there is no in-app history */
    back?: string
  }
}

export const CODEX_TABS = ['heroes', 'equips', 'talents', 'effects', 'lords', 'cp'] as const
export type CodexTab = (typeof CODEX_TABS)[number]

export const router = createRouter({
  // Hash history works on GitHub Pages without server rewrites.
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/lineups' },
    { path: '/lineups', component: () => import('./views/LineupsView.vue'), meta: { title: '阵容' } },
    {
      path: '/lineups/:key',
      component: () => import('./views/LineupDetailView.vue'),
      meta: { title: '阵容详情', back: '/lineups' },
    },
    { path: '/recommend', component: () => import('./views/RecommendView.vue'), meta: { title: '推荐' } },
    { path: '/rush', component: () => import('./views/RushView.vue'), meta: { title: '钻石狂潮' } },
    {
      path: '/rush/:id',
      component: () => import('./views/RushDetailView.vue'),
      meta: { title: '狂潮阵容', back: '/rush' },
    },
    { path: '/codex', redirect: '/codex/heroes' },
    {
      path: `/codex/:tab(${CODEX_TABS.join('|')})`,
      component: () => import('./views/CodexView.vue'),
      meta: { title: '图鉴' },
    },
    { path: '/me', component: () => import('./views/MeView.vue'), meta: { title: '我的' } },
    { path: '/:pathMatch(.*)*', redirect: '/lineups' },
  ],
  scrollBehavior(to, from, saved) {
    // Opening/closing a card detail only changes the query: keep the list scroll position.
    if (to.path === from.path) return false
    return saved ?? { top: 0 }
  },
})
