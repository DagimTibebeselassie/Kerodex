const path = window.location.pathname;

if (path === '/') {
  void import('./pages/Home');
} else if (path === '/cars' || path === '/search' || path === '/search.html') {
  void import('./pages/Search');
} else if (path.startsWith('/vehicle/')) {
  void import('./pages/VehicleDetail');
} else if (path === '/profile' || path === '/profile.html') {
  void import('./pages/Profile');
} else if (path === '/sell') {
  void import('./pages/Sell');
} else if (path === '/messages') {
  void import('./pages/Messages');
}
