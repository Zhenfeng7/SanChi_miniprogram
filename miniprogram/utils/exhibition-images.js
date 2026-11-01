const testImages = [
  '/images/exhibitions/test-05.jpg',
  '/images/exhibitions/test-06.jpg',
  '/images/exhibitions/test-07.jpg',
  '/images/exhibitions/test-09.jpg'
];

function withImages(exhibit) {
  const savedImages = Array.isArray(exhibit.galleryImages)
    ? exhibit.galleryImages.filter(image => typeof image === 'string' && image)
    : [];
  const testPhotos = ['placeholder-current', 'demo-current'].includes(exhibit._id)
    && !exhibit.coverImage && !savedImages.length;
  const galleryImages = testPhotos ? testImages : savedImages;
  return Object.assign({}, exhibit, {
    coverImage: exhibit.coverImage || galleryImages[0] || '',
    galleryImages,
    testPhotos
  });
}

module.exports = { withImages };
