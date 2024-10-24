export const isAdminUser = function (user: any) {
  if (process.env.ADMIN_USERS) {
    // const allowedAdmins = JSON.parse(process.env.ADMIN_USERS);
    const allowedAdmins = 'voyagersocialio@gmail.com';

    return user && allowedAdmins.includes(user.sub);
  } else {
    return false;
  }
};
