// Function to check if a user is an admin
export const isAdminUser = function (user: any) {
  // Check if the environment variable ADMIN_USERS is set
  if (process.env.ADMIN_USERS) {
    // Parse the ADMIN_USERS environment variable to get the list of allowed admin user IDs
    const allowedAdmins = JSON.parse(process.env.ADMIN_USERS);

    // Return true if the user exists and their ID is in the list of allowed admin user IDs
    return user && allowedAdmins.includes(user.sub);
  } else {
    // Return false if the ADMIN_USERS environment variable is not set
    return false;
  }
};
