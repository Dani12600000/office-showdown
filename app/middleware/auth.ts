export default defineNuxtRouteMiddleware((to) => {
  const user = useSupabaseUser()

  // Páginas públicas que não precisam de autenticação
  const publicRoutes = ['/login']

  if (!user.value && !publicRoutes.includes(to.path)) {
    return navigateTo('/login')
  }
})
