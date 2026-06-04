export default defineNuxtRouteMiddleware((to) => {
  const user = useSupabaseUser()

  // Páginas públicas que não precisam de autenticação
  const publicRoutes = ['/login', '/signup', '/recuperar-password', '/nova-password', '/aceitar-convite']

  if (!user.value && !publicRoutes.includes(to.path)) {
    return navigateTo('/login')
  }
})
