// User/Job Application Model
// Defines the shape of a job applicant document stored in the "jobs" collection.

function buildUserDocument(body) {
  return {
    jobTitle: body.jobTitle || null,
    first_name: body.first_name,
    last_name: body.last_name,
    email: body.email,
    mobile: parseInt(body.mobile),
    street_address: body.street_address,
    city: body.city,
    state: body.state,
    zipcode: parseInt(body.zipcode),
    country: body.country,
    linkedin: body.linkedin || null,
    portfolio: body.portfolio || null,
    resumeUrl: body.resumeUrl || null,
    resumePublicId: body.resumePublicId || null,
    createdAt: new Date(),
  };
}

module.exports = { buildUserDocument };