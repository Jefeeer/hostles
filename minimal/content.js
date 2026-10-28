// All editable site content lives here. To add a video, feedback or photo:
// drop the file into assets/ and add one entry below. Order = display order.
window.SITE = {
  socials: [
    { label: "Facebook", url: "https://www.facebook.com/LesterEventsHost" },
    { label: "Instagram", url: "https://www.instagram.com/hostlester/" },
    { label: "TikTok", url: "https://www.tiktok.com/@hostlester" }
  ],

  // About page, end section. Add `logo: "assets/partners/name.png"` when the logo file is supplied; until then the name shows as text.
  partners: [
    { name: "Freshminds Photography" },
    { name: "Mavis Catering" },
    { name: "Mahogany Place Tagaytay" },
    { name: "Kasalang Tagaytay" },
    { name: "Jennifer Wedding & Events" }
  ],

  // Videos: the first 4 are featured on the home page; all appear on videos.html.
  // `src` is the video file uploaded to assets/videos/ (MP4, H.264). `facebook` is the same video's Facebook post.
  // SAMPLE: sample-1/2.mp4 are free CC0 demo clips (MDN). Replace with Lester's videos, then delete the samples.
  videos: [
    { title: "Sample video 1", place: "Venue, Tagaytay", src: "assets/videos/sample-1.mp4", poster: "assets/erick-shayne.jpg", facebook: "https://www.facebook.com/LesterEventsHost/videos" },
    { title: "Sample video 2", place: "Venue, Cavite", src: "assets/videos/sample-2.mp4", poster: "assets/allen-khrishia.jpg", facebook: "https://www.facebook.com/LesterEventsHost/videos" },
    { title: "Sample video 3", place: "Venue, Batangas", src: "assets/videos/sample-1.mp4", poster: "assets/lester-on-stage.jpg", facebook: "https://www.facebook.com/LesterEventsHost/videos" },
    { title: "Sample video 4", place: "Venue, Tagaytay", src: "assets/videos/sample-2.mp4", poster: "assets/lester-portrait.jpg", facebook: "https://www.facebook.com/LesterEventsHost/videos" }
  ],

  // Feedback cards. Text longer than 100 characters gets a "Read more" toggle.
  feedback: [
    { name: "Paulene Balgoma-Lardizabal", event: "Wedding", photo: "assets/allen-khrishia.jpg", text: "We received all positive feedback from our guests." },
    { name: "Client name", event: "Wedding", photo: "assets/erick-shayne.jpg", text: "Placeholder: Lester to supply this client's feedback and photo. Longer feedback like this one is shortened to the first 100 characters with a Read more link, so every card stays the same tidy size." },
    { name: "Client name", event: "Corporate event", photo: "assets/lester-on-stage.jpg", text: "Placeholder: Lester to supply this client's feedback and photo." }
  ],
  feedbackStats: { percent: 100, reviews: 37, url: "https://www.facebook.com/LesterEventsHost/reviews" },

  // Gallery: grouped by `area`. The first photo listed for each area is its featured photo on the home page.
  gallery: [
    { area: "Tagaytay", src: "assets/allen-khrishia.jpg", alt: "Allen and Khrishia walking through a garden at Chateau Trouvaille" },
    { area: "Tagaytay", src: "assets/lester-portrait.jpg", alt: "Lester in a dark suit at an event" },
    { area: "Cavite", src: "assets/erick-shayne.jpg", alt: "Erick and Shayne on a wrought-iron staircase at Antigo de la Cumbre" },
    { area: "Batangas", src: "assets/lester-on-stage.jpg", alt: "Lester hosting on stage" }
  ]
};
