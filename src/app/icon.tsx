export default function Icon() {
  return new Response(null, {
    status: 302,
    headers: {
      Location: '/icons/32.png',
    },
  });
}
