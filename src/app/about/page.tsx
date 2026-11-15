import type { Metadata } from "next";
import { APP_NAME } from "@/lib/brand";

export const metadata: Metadata = { title: "About the data" };

export default function AboutPage() {
  return (
    <main className="prose">
      <h1>About the data</h1>

      <section>
        <h2>What you are looking at</h2>
        <p>
          {APP_NAME} compares active-fire detections from two families of NASA satellite sensors: MODIS (on Terra and Aqua, 1 km pixels) and
          VIIRS (on S-NPP, NOAA-20 and NOAA-21, 375 m pixels). Where a MODIS and a VIIRS detection fall close together in space and time, they
          are linked as potentially corresponding and combined into one harmonized record.
        </p>
        <ul>
          <li>A hotspot is a satellite detection of heat, not a confirmed fire. One fire can produce many detections, and some detections are not fires.</li>
          <li>A detection seen by only one sensor is not an error. The sensors differ in resolution and in the time they pass overhead.</li>
          <li>Agreement between the sensors is internal consistency, not accuracy against ground truth.</li>
        </ul>
      </section>

      <section>
        <h2>What is real and what is sample</h2>
        <p>
          While the header shows the <span className="tag">Sample data</span> tag, the markers, counts, calendar and charts are generated
          placeholder data shaped like FIRMS records. They are not real detections.
        </p>
        <p>
          Two things are real today: the Blue Marble imagery, and the &ldquo;Real NASA detections&rdquo; layer on the map, which shows
          NASA&apos;s published thermal-anomaly layers for a chosen day.
        </p>
      </section>

      <section>
        <h2>Sources</h2>
        <ul>
          <li>
            Active-fire detections: NASA{" "}
            <a href="https://earthdata.nasa.gov/firms" target="_blank" rel="noreferrer">Fire Information for Resource Management System (FIRMS)</a>.
          </li>
          <li>
            Imagery and daily thermal-anomaly layers: NASA{" "}
            <a href="https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api" target="_blank" rel="noreferrer">Global Imagery Browse Services (GIBS)</a>.
          </li>
          <li>Country outlines: Natural Earth, public domain.</li>
        </ul>
      </section>

      <section>
        <h2>Acknowledgment</h2>
        <blockquote>
          We acknowledge the use of data and/or imagery from NASA&apos;s Fire Information for Resource Management System (FIRMS)
          (https://earthdata.nasa.gov/firms), part of NASA&apos;s Land, Atmosphere Near real-time Capability for Earth observations (LANCE)
          (https://earthdata.nasa.gov/lance) and NASA&apos;s Earth Science Data and Information System (ESDIS).
        </blockquote>
      </section>

      <section>
        <h2>Disclaimer</h2>
        <p>
          FIRMS is operated by the ESDIS project. The information presented through LANCE, GIBS, Worldview and FIRMS is provided &ldquo;as
          is&rdquo; and users bear all responsibility and liability for their use of data. See the{" "}
          <a href="https://www.earthdata.nasa.gov/data/tools/firms/disclaimer" target="_blank" rel="noreferrer">full FIRMS disclaimer</a>.
        </p>
        <p>
          This tool was built for the NASA Space Apps Challenge. It is not endorsed by NASA, and it does not replace official fire products or
          emergency-response systems.
        </p>
      </section>
    </main>
  );
}
